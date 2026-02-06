import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  Building2,
  CheckCircle,
  MapPin,
  X,
  Loader2,
  FileText,
  Package,
  Users,
  Eye,
  Send,
  Save,
  Sparkles,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme } from '@/styles/dashboardTheme';
import { toast } from 'react-hot-toast';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface LineItemForm {
  tempId: string;
  description: string;
  part_number: string;
  quantity: string;
  unit_of_measure: string;
  target_unit_price: string;
  specifications: string;
}

interface SelectedSupplier {
  id: string;
  name: string;
  industry?: string;
  headquarters_location?: string;
  verified: boolean;
}

interface SupplierSearchResult {
  id: string;
  name: string;
  industry?: string;
  headquarters_location?: string;
  verified: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Metals & Alloys',
  'Plastics & Polymers',
  'Electronics Materials',
  'Chemicals & Resins',
  'Textiles & Fabrics',
  'Composites',
  'Raw Materials',
  'Components & Parts',
  'Mechanical Parts',
  'Electrical Components',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'INR', 'MXN'];

const UOM_OPTIONS = [
  'kg', 'g', 'lb', 'oz', 'units', 'pieces', 'meters', 'feet', 'liters', 'gallons', 'sheets', 'rolls',
];

const STEPS = [
  { number: 1, label: 'Basic Info', icon: FileText },
  { number: 2, label: 'Line Items', icon: Package },
  { number: 3, label: 'Invite Suppliers', icon: Users },
  { number: 4, label: 'Review & Submit', icon: Eye },
];

const genId = () => Math.random().toString(36).slice(2, 10);

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

const PostRFPPage: React.FC = () => {
  const router = useRouter();

  // Stepper
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 – Basic info
  const [basicInfo, setBasicInfo] = useState({
    title: '',
    description: '',
    material_category: '',
    delivery_deadline: '',
    budget_min: '',
    budget_max: '',
    currency: 'USD',
    is_sealed_bid: false,
    requires_nda: false,
  });

  // Step 2 – Line items
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    {
      tempId: genId(),
      description: '',
      part_number: '',
      quantity: '',
      unit_of_measure: '',
      target_unit_price: '',
      specifications: '',
    },
  ]);

  // Step 3 – Invite suppliers
  const [selectedSuppliers, setSelectedSuppliers] = useState<SelectedSupplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SupplierSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // AI Generate
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiConfidence(null);
    setAiWarnings([]);
    try {
      const res = await api.post('/api/v1/ai/generate-line-items', {
        buyer_intent: aiPrompt,
        category_hint: basicInfo.material_category || undefined,
        budget_hint:
          basicInfo.budget_max
            ? `${basicInfo.currency} ${basicInfo.budget_min || '0'} – ${basicInfo.budget_max}`
            : undefined,
      });
      const data = res.data;
      if (data.line_items && data.line_items.length > 0) {
        const mapped: LineItemForm[] = data.line_items.map((li: any) => ({
          tempId: genId(),
          description: li.description || '',
          part_number: li.part_number || '',
          quantity: li.quantity != null ? String(li.quantity) : '',
          unit_of_measure: li.unit_of_measure || '',
          target_unit_price: li.target_unit_price != null ? String(li.target_unit_price) : '',
          specifications: li.specifications || '',
        }));
        setLineItems(mapped);
        toast.success(`AI generated ${mapped.length} line item(s)`);
      }
      if (data.confidence != null) setAiConfidence(data.confidence);
      if (data.warnings?.length) setAiWarnings(data.warnings);
      setShowAIModal(false);
    } catch {
      toast.error('AI generation failed — please add items manually.');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return basicInfo.title.trim().length > 0;
      case 2:
        return lineItems.every((li) => li.description.trim().length > 0);
      case 3:
        return true; // optional
      case 4:
        return true;
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  // ── Navigation ─────────────────────────────────────────────────
  const goNext = () => {
    if (canProceed && currentStep < 4) setCurrentStep(currentStep + 1);
  };
  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // ── Line items helpers ─────────────────────────────────────────
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        tempId: genId(),
        description: '',
        part_number: '',
        quantity: '',
        unit_of_measure: '',
        target_unit_price: '',
        specifications: '',
      },
    ]);
  };

  const removeLineItem = (tempId: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.tempId !== tempId));
  };

  const updateLineItem = (tempId: string, field: keyof LineItemForm, value: string) => {
    setLineItems((prev) =>
      prev.map((li) => (li.tempId === tempId ? { ...li, [field]: value } : li)),
    );
  };

  const moveLineItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lineItems.length) return;
    const updated = [...lineItems];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLineItems(updated);
  };

  // ── Supplier search ────────────────────────────────────────────
  const handleSupplierSearch = (query: string) => {
    setSupplierSearch(query);
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/api/v1/companies/search', { params: { q: query } });
        const results: SupplierSearchResult[] = res.data.companies || res.data || [];
        const selectedIds = new Set(selectedSuppliers.map((s) => s.id));
        setSearchResults(results.filter((r) => !selectedIds.has(r.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    setSearchTimeout(timeout);
  };

  const selectSupplier = (supplier: SupplierSearchResult) => {
    setSelectedSuppliers((prev) => [...prev, supplier]);
    setSearchResults((prev) => prev.filter((r) => r.id !== supplier.id));
  };

  const removeSupplier = (id: string) => {
    setSelectedSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      // 1. Create RFQ
      const rfqPayload: Record<string, any> = {
        title: basicInfo.title,
        description: basicInfo.description,
        material_category: basicInfo.material_category || undefined,
        delivery_deadline: basicInfo.delivery_deadline || undefined,
        budget_min: basicInfo.budget_min ? parseFloat(basicInfo.budget_min) : undefined,
        budget_max: basicInfo.budget_max ? parseFloat(basicInfo.budget_max) : undefined,
        currency: basicInfo.currency,
        is_sealed_bid: basicInfo.is_sealed_bid,
        requires_nda: basicInfo.requires_nda,
        status: asDraft ? 'draft' : 'published',
      };

      const rfqRes = await api.post('/api/v1/rfqs/', rfqPayload);
      const rfqId = rfqRes.data.id;

      // 2. Create line items
      const validLineItems = lineItems.filter((li) => li.description.trim());
      if (validLineItems.length > 0) {
        await Promise.all(
          validLineItems.map((li, idx) =>
            api.post(`/api/v1/rfqs/${rfqId}/line-items`, {
              line_number: idx + 1,
              description: li.description,
              part_number: li.part_number || undefined,
              quantity: li.quantity ? parseFloat(li.quantity) : undefined,
              unit_of_measure: li.unit_of_measure || undefined,
              target_unit_price: li.target_unit_price ? parseFloat(li.target_unit_price) : undefined,
              specifications: li.specifications || undefined,
              currency: basicInfo.currency,
            }),
          ),
        );
      }

      // 3. Send invitations
      if (selectedSuppliers.length > 0) {
        await Promise.all(
          selectedSuppliers.map((supplier) =>
            api.post(`/api/v1/rfqs/${rfqId}/invite`, {
              supplier_company_id: supplier.id,
              message: inviteMessage || undefined,
            }),
          ),
        );
      }

      toast.success(asDraft ? 'RFQ saved as draft!' : 'RFQ published successfully!');
      router.push('/dashboard/post-rfq');
    } catch {
      // error toast handled by api interceptor
    } finally {
      setSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Background decorations */}
      <div className={dashboardTheme.decorativeBackground.container}>
        <div className={dashboardTheme.decorativeBackground.orb1} />
        <div className={dashboardTheme.decorativeBackground.orb2} />
      </div>

      <div className={dashboardTheme.mainContent.container}>
        {/* Back link */}
        <Link
          href="/dashboard/post-rfq"
          className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to RFQs
        </Link>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display">
            Create New RFQ
          </h1>
          <p className="text-secondary-500 text-sm mt-1">
            Build your request for quote step by step
          </p>
        </div>

        {/* ── Stepper Bar ─────────────────────────────────────────── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = step.number === currentStep;
              const isCompleted = step.number < currentStep;
              const Icon = step.icon;

              return (
                <React.Fragment key={step.number}>
                  {/* Step circle + label */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                          : isCompleted
                          ? 'bg-green-50 text-green-600 border border-green-100'
                          : 'bg-secondary-100 text-secondary-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium hidden sm:block ${
                        isActive
                          ? 'text-primary-600'
                          : isCompleted
                          ? 'text-green-600'
                          : 'text-secondary-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-3 h-0.5 rounded-full overflow-hidden bg-secondary-200">
                      <div
                        className={`h-full bg-green-500 transition-all duration-300 ${
                          isCompleted ? 'w-full' : 'w-0'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Step Content ─────────────────────────────────────────── */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 lg:p-8">
          {/* ── STEP 1: Basic Info ───────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-secondary-900 font-display">Basic Information</h2>

              {/* Title */}
              <div>
                <label className={dashboardTheme.forms.label}>
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aluminum extrusions for Q3 production run"
                  value={basicInfo.title}
                  onChange={(e) => setBasicInfo({ ...basicInfo, title: e.target.value })}
                  className={dashboardTheme.forms.input}
                />
              </div>

              {/* Description */}
              <div>
                <label className={dashboardTheme.forms.label}>Description</label>
                <textarea
                  rows={5}
                  placeholder="Provide detailed requirements, specifications, and any additional context for suppliers..."
                  value={basicInfo.description}
                  onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })}
                  className={dashboardTheme.forms.textarea}
                />
              </div>

              {/* Category & Deadline row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={dashboardTheme.forms.label}>Category</label>
                  <select
                    value={basicInfo.material_category}
                    onChange={(e) =>
                      setBasicInfo({ ...basicInfo, material_category: e.target.value })
                    }
                    className={dashboardTheme.forms.select}
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={dashboardTheme.forms.label}>Deadline</label>
                  <input
                    type="date"
                    value={basicInfo.delivery_deadline}
                    onChange={(e) =>
                      setBasicInfo({ ...basicInfo, delivery_deadline: e.target.value })
                    }
                    className={dashboardTheme.forms.input}
                  />
                </div>
              </div>

              {/* Budget range & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={dashboardTheme.forms.label}>Budget Min</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={basicInfo.budget_min}
                    onChange={(e) => setBasicInfo({ ...basicInfo, budget_min: e.target.value })}
                    className={dashboardTheme.forms.input}
                  />
                </div>
                <div>
                  <label className={dashboardTheme.forms.label}>Budget Max</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={basicInfo.budget_max}
                    onChange={(e) => setBasicInfo({ ...basicInfo, budget_max: e.target.value })}
                    className={dashboardTheme.forms.input}
                  />
                </div>
                <div>
                  <label className={dashboardTheme.forms.label}>Currency</label>
                  <select
                    value={basicInfo.currency}
                    onChange={(e) => setBasicInfo({ ...basicInfo, currency: e.target.value })}
                    className={dashboardTheme.forms.select}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={basicInfo.is_sealed_bid}
                    onChange={(e) =>
                      setBasicInfo({ ...basicInfo, is_sealed_bid: e.target.checked })
                    }
                    className={dashboardTheme.forms.checkbox}
                  />
                  <span className="text-sm text-secondary-700">Sealed Bid</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={basicInfo.requires_nda}
                    onChange={(e) =>
                      setBasicInfo({ ...basicInfo, requires_nda: e.target.checked })
                    }
                    className={dashboardTheme.forms.checkbox}
                  />
                  <span className="text-sm text-secondary-700">Requires NDA</span>
                </label>
              </div>
            </div>
          )}

          {/* ── STEP 2: Line Items ──────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-secondary-900 font-display">Line Items</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAIModal(true)}
                    className={`${dashboardTheme.buttons.secondary} ${dashboardTheme.buttons.small} flex items-center gap-1.5`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Generate
                  </button>
                  <button
                    onClick={addLineItem}
                    className={`${dashboardTheme.buttons.secondary} ${dashboardTheme.buttons.small} flex items-center gap-1.5`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Line Item
                  </button>
                </div>
              </div>

              {/* AI confidence & warnings */}
              {aiConfidence !== null && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 border border-primary-100 text-sm">
                  <Wand2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <span className="text-primary-700 font-medium">
                    AI confidence: {Math.round(aiConfidence * 100)}%
                  </span>
                </div>
              )}
              {aiWarnings.length > 0 && (
                <div className="space-y-1">
                  {aiWarnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* AI Generate Modal */}
              {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-secondary-900/30 backdrop-blur-sm" onClick={() => setShowAIModal(false)} />
                  <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-secondary-900 font-display flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary-600" />
                        AI Line Item Generator
                      </h3>
                      <button onClick={() => setShowAIModal(false)} className="p-1.5 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-100 transition-all">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-secondary-500">
                      Describe what you need in plain language and AI will generate structured line items.
                    </p>
                    <textarea
                      rows={5}
                      placeholder="e.g. I need 500 sheets of 0.040&quot; 6061-T6 aluminum, cut to 48x96 inches, with a mill finish. Also 200 lbs of 304 stainless steel round bar, 1&quot; diameter."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className={dashboardTheme.forms.textarea}
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowAIModal(false)} className={dashboardTheme.buttons.secondary}>
                        Cancel
                      </button>
                      <button
                        onClick={handleAIGenerate}
                        disabled={aiLoading || aiPrompt.trim().length < 10}
                        className={aiLoading || aiPrompt.trim().length < 10 ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary}
                      >
                        {aiLoading ? (
                          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Generating...</span>
                        ) : (
                          <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" />Generate</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {lineItems.map((li, index) => (
                <div
                  key={li.tempId}
                  className="border border-secondary-200 rounded-xl p-5 space-y-4 bg-white/50"
                >
                  {/* Line header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-secondary-900">
                      Line {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveLineItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-secondary-400 hover:text-secondary-600 disabled:opacity-30 rounded-lg hover:bg-secondary-100 transition-all"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveLineItem(index, 'down')}
                        disabled={index === lineItems.length - 1}
                        className="p-1.5 text-secondary-400 hover:text-secondary-600 disabled:opacity-30 rounded-lg hover:bg-secondary-100 transition-all"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeLineItem(li.tempId)}
                        disabled={lineItems.length <= 1}
                        className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30 rounded-lg hover:bg-red-50 transition-all ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className={dashboardTheme.forms.label}>
                      Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Describe the item or service required"
                      value={li.description}
                      onChange={(e) =>
                        updateLineItem(li.tempId, 'description', e.target.value)
                      }
                      className={dashboardTheme.forms.input}
                    />
                  </div>

                  {/* Part number & Quantity */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={dashboardTheme.forms.label}>Part Number</label>
                      <input
                        type="text"
                        placeholder="e.g. AL-6061-T6"
                        value={li.part_number}
                        onChange={(e) =>
                          updateLineItem(li.tempId, 'part_number', e.target.value)
                        }
                        className={dashboardTheme.forms.input}
                      />
                    </div>
                    <div>
                      <label className={dashboardTheme.forms.label}>Quantity</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={li.quantity}
                        onChange={(e) =>
                          updateLineItem(li.tempId, 'quantity', e.target.value)
                        }
                        className={dashboardTheme.forms.input}
                      />
                    </div>
                    <div>
                      <label className={dashboardTheme.forms.label}>Unit of Measure</label>
                      <select
                        value={li.unit_of_measure}
                        onChange={(e) =>
                          updateLineItem(li.tempId, 'unit_of_measure', e.target.value)
                        }
                        className={dashboardTheme.forms.select}
                      >
                        <option value="">Select UoM</option>
                        {UOM_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Target price & Specs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={dashboardTheme.forms.label}>Target Unit Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={li.target_unit_price}
                        onChange={(e) =>
                          updateLineItem(li.tempId, 'target_unit_price', e.target.value)
                        }
                        className={dashboardTheme.forms.input}
                      />
                    </div>
                    <div>
                      <label className={dashboardTheme.forms.label}>Specifications</label>
                      <input
                        type="text"
                        placeholder="Alloy grade, tolerances, finish..."
                        value={li.specifications}
                        onChange={(e) =>
                          updateLineItem(li.tempId, 'specifications', e.target.value)
                        }
                        className={dashboardTheme.forms.input}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 3: Invite Suppliers ────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-secondary-900 font-display">
                Invite Suppliers
              </h2>
              <p className="text-sm text-secondary-500">
                Search for suppliers to invite to this RFQ. You can also skip this step and invite
                suppliers later.
              </p>

              {/* Search */}
              <div>
                <label className={dashboardTheme.forms.label}>Search Companies</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Search by company name, industry..."
                    value={supplierSearch}
                    onChange={(e) => handleSupplierSearch(e.target.value)}
                    className={`${dashboardTheme.forms.input} pl-10`}
                  />
                  {searching && (
                    <Loader2 className="absolute right-3.5 top-3.5 w-4 h-4 text-secondary-400 animate-spin" />
                  )}
                </div>

                {/* Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-secondary-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => selectSupplier(s)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary-50 border-b border-secondary-100 last:border-0 transition-colors"
                      >
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-secondary-900 truncate">
                              {s.name}
                            </span>
                            {s.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-secondary-500 mt-0.5">
                            {s.industry && <span>{s.industry}</span>}
                            {s.headquarters_location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {s.headquarters_location}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {supplierSearch && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-secondary-400 mt-2 pl-1">
                    No companies found matching &quot;{supplierSearch}&quot;
                  </p>
                )}
              </div>

              {/* Selected */}
              {selectedSuppliers.length > 0 && (
                <div>
                  <label className={dashboardTheme.forms.label}>
                    Selected Suppliers ({selectedSuppliers.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSuppliers.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-lg text-sm font-medium"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {s.name}
                        <button
                          onClick={() => removeSupplier(s.id)}
                          className="ml-0.5 p-0.5 hover:bg-primary-100 rounded transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Invitation message */}
              <div>
                <label className={dashboardTheme.forms.label}>
                  Invitation Message{' '}
                  <span className="text-secondary-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Add a personal message to accompany the invitations..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className={dashboardTheme.forms.textarea}
                />
              </div>
            </div>
          )}

          {/* ── STEP 4: Review & Submit ─────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-8">
              <h2 className="text-lg font-bold text-secondary-900 font-display">Review & Submit</h2>

              {/* Basic info summary */}
              <div className="border border-secondary-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">
                  Basic Info
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-secondary-500">Title:</span>{' '}
                    <span className="font-medium text-secondary-900">{basicInfo.title || '—'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-500">Category:</span>{' '}
                    <span className="font-medium text-secondary-900">
                      {basicInfo.material_category || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-500">Deadline:</span>{' '}
                    <span className="font-medium text-secondary-900">
                      {basicInfo.delivery_deadline || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-500">Budget:</span>{' '}
                    <span className="font-medium text-secondary-900">
                      {basicInfo.budget_min || basicInfo.budget_max
                        ? `${basicInfo.currency} ${basicInfo.budget_min || '0'} – ${basicInfo.budget_max || '∞'}`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-500">Sealed Bid:</span>{' '}
                    <span className="font-medium text-secondary-900">
                      {basicInfo.is_sealed_bid ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary-500">Requires NDA:</span>{' '}
                    <span className="font-medium text-secondary-900">
                      {basicInfo.requires_nda ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                {basicInfo.description && (
                  <div className="text-sm">
                    <span className="text-secondary-500">Description:</span>
                    <p className="mt-1 text-secondary-700 whitespace-pre-wrap">
                      {basicInfo.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Line items summary */}
              <div className="border border-secondary-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 bg-secondary-50 border-b border-secondary-200">
                  <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">
                    Line Items ({lineItems.filter((li) => li.description.trim()).length})
                  </h3>
                </div>
                <div className="divide-y divide-secondary-100">
                  {lineItems
                    .filter((li) => li.description.trim())
                    .map((li, idx) => (
                      <div key={li.tempId} className="px-5 py-3 flex items-center gap-4 text-sm">
                        <span className="text-secondary-400 font-mono text-xs w-6">
                          #{idx + 1}
                        </span>
                        <span className="font-medium text-secondary-900 flex-1">
                          {li.description}
                        </span>
                        {li.part_number && (
                          <span className="text-secondary-400 text-xs">PN: {li.part_number}</span>
                        )}
                        {li.quantity && (
                          <span className="text-secondary-500">
                            {li.quantity} {li.unit_of_measure}
                          </span>
                        )}
                        {li.target_unit_price && (
                          <span className="text-secondary-500">
                            @ {basicInfo.currency} {li.target_unit_price}
                          </span>
                        )}
                      </div>
                    ))}
                  {lineItems.filter((li) => li.description.trim()).length === 0 && (
                    <div className="px-5 py-6 text-center text-sm text-secondary-400">
                      No line items added
                    </div>
                  )}
                </div>
              </div>

              {/* Invited suppliers summary */}
              <div className="border border-secondary-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">
                  Invited Suppliers ({selectedSuppliers.length})
                </h3>
                {selectedSuppliers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedSuppliers.map((s) => (
                      <span
                        key={s.id}
                        className={dashboardTheme.badges.primary}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-secondary-400">
                    No suppliers invited — RFQ will be visible to all suppliers.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation Buttons ───────────────────────────────────── */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={goBack}
            disabled={currentStep === 1}
            className={
              currentStep === 1 ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.secondary
            }
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep === 4 ? (
              <>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className={
                    submitting
                      ? dashboardTheme.buttons.disabled
                      : dashboardTheme.buttons.secondary
                  }
                >
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save as Draft
                  </span>
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || !basicInfo.title.trim()}
                  className={
                    submitting || !basicInfo.title.trim()
                      ? dashboardTheme.buttons.disabled
                      : dashboardTheme.buttons.primary
                  }
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Publish RFQ
                    </span>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={goNext}
                disabled={!canProceed}
                className={
                  !canProceed ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary
                }
              >
                <span className="flex items-center gap-2">
                  Next
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostRFPPage;
