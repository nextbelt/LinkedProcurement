import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Shield,
  Package,
  ClipboardList,
  CheckCircle2,
  Info,
  ThumbsUp,
  ThumbsDown,
  Save,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { Company } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  part_number: string;
  quantity: number;
  uom: string;
  target_unit_price: number;
  specs: string;
}

interface AISuggestion {
  id: string;
  text: string;
  type: 'tip' | 'warning' | 'improvement';
  accepted?: boolean;
}

interface RFPFormData {
  title: string;
  category: string;
  description: string;
  delivery_location: string;
  deadline: string;
  budget_min: number | '';
  budget_max: number | '';
  currency: string;
  visibility: 'public' | 'private' | 'invited_only';
  sealed_bid: boolean;
  nda_required: boolean;
}

interface AttachmentFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

const STEPS = [
  { label: 'Details', icon: FileText },
  { label: 'Line Items', icon: Package },
  { label: 'Requirements', icon: ClipboardList },
  { label: 'Review & Publish', icon: CheckCircle2 },
];

const CATEGORIES = [
  'Raw Materials', 'Fasteners', 'Electronics', 'Packaging', 'Chemicals',
  'Metals', 'Plastics', 'Rubber', 'Textiles', 'Wood Products',
  'Glass', 'Ceramics', 'Composites', 'Adhesives', 'Coatings',
  'Machined Parts', 'Castings', 'Forgings', 'Stampings', 'Other',
];

const UOM_OPTIONS = [
  'each', 'pcs', 'kg', 'lbs', 'meters', 'feet', 'liters', 'gallons',
  'tons', 'sq ft', 'sq m', 'cu ft', 'cu m', 'rolls', 'sheets', 'boxes',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];

const CERTIFICATIONS = [
  'ISO 9001', 'ISO 14001', 'AS9100', 'ITAR', 'RoHS', 'REACH',
  'UL', 'CE', 'FDA', 'NADCAP',
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const getTomorrowDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

// ── AI Sidebar ───────────────────────────────────────────────────────────────

const AISidebar: React.FC<{
  step: number;
  suggestions: AISuggestion[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  loading: boolean;
}> = ({ step, suggestions, onAccept, onDismiss, loading }) => {
  const stepLabels = ['Details', 'Line Items', 'Requirements', 'Review'];

  return (
    <aside className="hidden xl:block w-80 flex-shrink-0">
      <div className="sticky top-24">
        <div className={`${dashboardTheme.cards.primary} p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-secondary-900">AI Assistant</h3>
              <p className="text-xs text-secondary-400">Step: {stepLabels[step]}</p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-4 text-sm text-secondary-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing your RFP...
            </div>
          )}

          {suggestions.length === 0 && !loading && (
            <p className="text-xs text-secondary-400 py-4 text-center">
              AI suggestions will appear here as you fill out the form.
            </p>
          )}

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {suggestions.filter(s => s.accepted === undefined).map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-3 rounded-xl border text-sm ${
                  suggestion.type === 'warning'
                    ? 'bg-amber-50/50 border-amber-200 text-amber-800'
                    : suggestion.type === 'improvement'
                    ? 'bg-blue-50/50 border-blue-200 text-blue-800'
                    : 'bg-green-50/50 border-green-200 text-green-800'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  {suggestion.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : suggestion.type === 'improvement' ? (
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1">{suggestion.text}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => onAccept(suggestion.id)}
                    className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                    title="Accept"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDismiss(suggestion.id)}
                    className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                    title="Dismiss"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const NewRFPPage: React.FC = () => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ndaInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSidebarLoading, setAiSidebarLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form data
  const [formData, setFormData] = useState<RFPFormData>({
    title: '',
    category: '',
    description: '',
    delivery_location: '',
    deadline: '',
    budget_min: '',
    budget_max: '',
    currency: 'USD',
    visibility: 'public',
    sealed_bid: false,
    nda_required: false,
  });

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', part_number: '', quantity: 1, uom: 'each', target_unit_price: 0, specs: '' },
  ]);

  // Requirements
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [customCert, setCustomCert] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState<Company[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [ndaFile, setNdaFile] = useState<AttachmentFile | null>(null);
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);

  // ── AI suggestion generation ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      generateContextualSuggestions();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, formData.title, formData.category, lineItems.length, selectedCerts.length]);

  const generateContextualSuggestions = () => {
    const newSuggestions: AISuggestion[] = [];
    if (currentStep === 0) {
      if (!formData.delivery_location) {
        newSuggestions.push({ id: generateId(), text: 'Consider adding a delivery location to get more accurate quotes.', type: 'tip' });
      }
      if (!formData.deadline) {
        newSuggestions.push({ id: generateId(), text: 'Similar RFPs typically have 2-week deadlines. Consider setting a realistic timeline.', type: 'tip' });
      }
      if (formData.description.length > 0 && formData.description.length < 100) {
        newSuggestions.push({ id: generateId(), text: 'A more detailed description helps suppliers provide accurate quotes.', type: 'warning' });
      }
    } else if (currentStep === 1) {
      if (lineItems.length === 1 && !lineItems[0].description) {
        newSuggestions.push({ id: generateId(), text: 'Try AI Generate to automatically create line items from a description.', type: 'improvement' });
      }
      if (lineItems.some(li => li.target_unit_price === 0 && li.description)) {
        newSuggestions.push({ id: generateId(), text: 'Adding target prices helps suppliers understand your budget expectations.', type: 'tip' });
      }
    } else if (currentStep === 2) {
      if (selectedCerts.length === 0 && formData.category) {
        newSuggestions.push({ id: generateId(), text: 'Based on your items, consider requiring ISO 9001 and RoHS certifications.', type: 'improvement' });
      }
      if (selectedSuppliers.length === 0) {
        newSuggestions.push({ id: generateId(), text: 'Adding preferred suppliers can speed up the response process.', type: 'tip' });
      }
    }
    if (newSuggestions.length > 0) {
      setAiSuggestions(prev => {
        const existingTexts = new Set(prev.map(s => s.text));
        const unique = newSuggestions.filter(s => !existingTexts.has(s.text));
        return [...prev, ...unique];
      });
    }
  };

  const handleAcceptSuggestion = (id: string) => {
    setAiSuggestions(prev => prev.map(s => s.id === id ? { ...s, accepted: true } : s));
  };

  const handleDismissSuggestion = (id: string) => {
    setAiSuggestions(prev => prev.map(s => s.id === id ? { ...s, accepted: false } : s));
  };

  // ── Form handlers ────────────────────────────────────────────────────────
  const updateForm = (field: keyof RFPFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // ── Line item handlers ───────────────────────────────────────────────────
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: generateId(), description: '', part_number: '', quantity: 1, uom: 'each', target_unit_price: 0, specs: '' },
    ]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(li => li.id !== id));
    }
  };

  const totalEstimatedValue = lineItems.reduce((sum, li) => sum + (li.quantity * li.target_unit_price), 0);

  // ── AI Generate ──────────────────────────────────────────────────────────
  const handleAIGenerate = async () => {
    if (!aiGeneratePrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await api.post('/api/v1/ai/generate-line-items', {
        description: aiGeneratePrompt,
        category: formData.category,
      });
      if (res.data?.line_items) {
        const generated: LineItem[] = res.data.line_items.map((item: any) => ({
          id: generateId(),
          description: item.description || '',
          part_number: item.part_number || '',
          quantity: item.quantity || 1,
          uom: item.uom || 'each',
          target_unit_price: item.target_unit_price || 0,
          specs: item.specs || '',
        }));
        setLineItems(generated);
        setShowAIGenerate(false);
        setAiGeneratePrompt('');
      }
    } catch {
      // Error handled by interceptor
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Supplier search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (supplierSearch.length < 2) {
      setSupplierResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingSuppliers(true);
      try {
        const res = await api.get(`/api/v1/companies/search?query=${encodeURIComponent(supplierSearch)}&limit=5`);
        setSupplierResults(res.data?.data || res.data || []);
      } catch {
        setSupplierResults([]);
      } finally {
        setSearchingSuppliers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  const addSupplier = (supplier: Company) => {
    if (!selectedSuppliers.find(s => s.id === supplier.id)) {
      setSelectedSuppliers(prev => [...prev, { id: supplier.id, name: supplier.name }]);
    }
    setSupplierSearch('');
    setSupplierResults([]);
  };

  const removeSupplier = (id: string) => {
    setSelectedSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // ── File handling ────────────────────────────────────────────────────────
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [attachments]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const maxFiles = 10;
    const maxSize = 25 * 1024 * 1024; // 25MB
    const remaining = maxFiles - attachments.length;
    const validFiles = files.slice(0, remaining).filter(f => f.size <= maxSize);

    const newAttachments: AttachmentFile[] = validFiles.map(file => ({
      id: generateId(),
      file,
      progress: 100,
      status: 'completed' as const,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleNdaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNdaFile({
        id: generateId(),
        file: e.target.files[0],
        progress: 100,
        status: 'completed',
      });
    }
  };

  // ── Cert handling ────────────────────────────────────────────────────────
  const toggleCert = (cert: string) => {
    setSelectedCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const addCustomCert = () => {
    if (customCert.trim() && !selectedCerts.includes(customCert.trim())) {
      setSelectedCerts(prev => [...prev, customCert.trim()]);
      setCustomCert('');
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.title.trim()) newErrors.title = 'Title is required';
      if (!formData.category) newErrors.category = 'Category is required';
      if (formData.description.length < 100) newErrors.description = `Description must be at least 100 characters (${formData.description.length}/100)`;
      if (!formData.deadline) newErrors.deadline = 'Deadline is required';
    } else if (step === 1) {
      const hasValidItem = lineItems.some(li => li.description.trim());
      if (!hasValidItem) newErrors.lineItems = 'At least one line item with a description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  const goToStep = (step: number) => {
    if (step < currentStep || completedSteps.has(step) || step === currentStep + 1) {
      if (step > currentStep && !validateStep(currentStep)) return;
      if (step > currentStep) {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
      }
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // ── Save / Publish ────────────────────────────────────────────────────────
  const buildPayload = () => ({
    title: formData.title,
    material_category: formData.category,
    specifications: formData.description,
    delivery_location: formData.delivery_location,
    delivery_deadline: formData.deadline,
    budget_min: formData.budget_min || undefined,
    budget_max: formData.budget_max || undefined,
    currency: formData.currency,
    visibility: formData.visibility,
    sealed_bid: formData.sealed_bid,
    nda_required: formData.nda_required,
    line_items: lineItems.filter(li => li.description.trim()).map((li, idx) => ({
      item_number: idx + 1,
      description: li.description,
      part_number: li.part_number,
      quantity: li.quantity,
      uom: li.uom,
      target_unit_price: li.target_unit_price,
      specifications: li.specs,
    })),
    required_certifications: selectedCerts,
    preferred_supplier_ids: selectedSuppliers.map(s => s.id),
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await api.post('/api/v1/rfqs', { ...buildPayload(), status: 'draft' });
      router.push('/rfps');
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.post('/api/v1/rfqs', { ...buildPayload(), status: 'active' });
      router.push('/rfps');
    } catch {
      // handled by interceptor
    } finally {
      setPublishing(false);
      setShowPublishModal(false);
    }
  };

  const handleAISuggestImprovements = async () => {
    setAiSidebarLoading(true);
    try {
      const res = await api.post('/api/v1/ai/generate-line-items', {
        description: `Review and suggest improvements for this RFP: ${formData.title}. ${formData.description}`,
        category: formData.category,
      });
      if (res.data?.suggestions) {
        const newSuggestions: AISuggestion[] = res.data.suggestions.map((s: string) => ({
          id: generateId(),
          text: s,
          type: 'improvement' as const,
        }));
        setAiSuggestions(prev => [...prev, ...newSuggestions]);
      }
    } catch {
      // handled
    } finally {
      setAiSidebarLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: 'New RFP' }]} />
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            {/* Back link */}
            <button
              onClick={() => router.push('/rfps')}
              className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to RFPs
            </button>

            <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display mb-8">
              Create New RFP
            </h1>

            {/* ── Progress Bar ──────────────────────────────────────────── */}
            <div className="mb-10">
              <div className="flex items-center justify-between">
                {STEPS.map((step, idx) => (
                  <React.Fragment key={step.label}>
                    {idx > 0 && (
                      <div className={`flex-1 h-0.5 mx-2 ${idx <= currentStep ? 'bg-primary-500' : 'bg-secondary-200'} transition-colors`} />
                    )}
                    <button
                      onClick={() => goToStep(idx)}
                      className="flex flex-col items-center gap-2 group"
                      disabled={idx > currentStep + 1 && !completedSteps.has(idx)}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                          completedSteps.has(idx)
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                            : idx === currentStep
                            ? 'bg-white border-2 border-primary-600 text-primary-600 shadow-lg'
                            : 'bg-secondary-100 text-secondary-400 border-2 border-secondary-200'
                        }`}
                      >
                        {completedSteps.has(idx) ? <Check className="w-5 h-5" /> : idx + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${idx === currentStep ? 'text-primary-600' : 'text-secondary-400'}`}>
                        {step.label}
                      </span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ── Main Content Area + AI Sidebar ────────────────────────── */}
            <div className="flex gap-8">
              {/* Main Form */}
              <div className="flex-1 max-w-3xl">

                {/* ── STEP 1: DETAILS ───────────────────────────────────── */}
                {currentStep === 0 && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    <h2 className="text-lg font-bold text-secondary-900 font-display mb-6">RFP Details</h2>

                    <div className="space-y-5">
                      {/* Title */}
                      <div>
                        <label className={dashboardTheme.forms.label}>Title <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={e => updateForm('title', e.target.value)}
                          placeholder="e.g., Custom Aluminum Extrusions for Q2 2026 Production"
                          className={`${dashboardTheme.forms.input} ${errors.title ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                        />
                        {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
                      </div>

                      {/* Category */}
                      <div>
                        <label className={dashboardTheme.forms.label}>Category <span className="text-red-500">*</span></label>
                        <select
                          value={formData.category}
                          onChange={e => updateForm('category', e.target.value)}
                          className={`${dashboardTheme.forms.select} ${errors.category ? 'border-red-300' : ''}`}
                        >
                          <option value="">Select a category</option>
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
                      </div>

                      {/* Description */}
                      <div>
                        <label className={dashboardTheme.forms.label}>
                          Description <span className="text-red-500">*</span>
                          <span className="text-secondary-400 ml-1">({formData.description.length}/100 min)</span>
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={e => updateForm('description', e.target.value)}
                          rows={5}
                          placeholder="Provide a detailed description of your requirements, including specifications, quality standards, and any special instructions..."
                          className={`${dashboardTheme.forms.textarea} ${errors.description ? 'border-red-300' : ''}`}
                        />
                        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
                      </div>

                      {/* Delivery location + Deadline */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className={dashboardTheme.forms.label}>Delivery Location</label>
                          <input
                            type="text"
                            value={formData.delivery_location}
                            onChange={e => updateForm('delivery_location', e.target.value)}
                            placeholder="e.g., Chicago, IL, USA"
                            className={dashboardTheme.forms.input}
                          />
                        </div>
                        <div>
                          <label className={dashboardTheme.forms.label}>Deadline <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={formData.deadline}
                            min={getTomorrowDate()}
                            onChange={e => updateForm('deadline', e.target.value)}
                            className={`${dashboardTheme.forms.input} ${errors.deadline ? 'border-red-300' : ''}`}
                          />
                          {errors.deadline && <p className="mt-1 text-xs text-red-500">{errors.deadline}</p>}
                        </div>
                      </div>

                      {/* Budget Range */}
                      <div>
                        <label className={dashboardTheme.forms.label}>Budget Range</label>
                        <div className="flex items-center gap-3">
                          <select
                            value={formData.currency}
                            onChange={e => updateForm('currency', e.target.value)}
                            className={`${dashboardTheme.forms.select} w-24 flex-shrink-0`}
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input
                            type="number"
                            value={formData.budget_min}
                            onChange={e => updateForm('budget_min', e.target.value ? Number(e.target.value) : '')}
                            placeholder="Min"
                            min={0}
                            className={`${dashboardTheme.forms.input} flex-1`}
                          />
                          <span className="text-secondary-400">—</span>
                          <input
                            type="number"
                            value={formData.budget_max}
                            onChange={e => updateForm('budget_max', e.target.value ? Number(e.target.value) : '')}
                            placeholder="Max"
                            min={0}
                            className={`${dashboardTheme.forms.input} flex-1`}
                          />
                        </div>
                      </div>

                      {/* Visibility */}
                      <div>
                        <label className={dashboardTheme.forms.label}>Visibility</label>
                        <div className="flex flex-wrap gap-4 mt-1">
                          {[
                            { value: 'public', label: 'Public', icon: Eye, desc: 'Visible to all suppliers' },
                            { value: 'private', label: 'Private', icon: EyeOff, desc: 'Hidden from search' },
                            { value: 'invited_only', label: 'Invited Only', icon: Lock, desc: 'Only invited suppliers' },
                          ].map(opt => (
                            <label
                              key={opt.value}
                              className={`flex-1 min-w-[140px] p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                formData.visibility === opt.value
                                  ? 'border-primary-500 bg-primary-50/50'
                                  : 'border-secondary-200 hover:border-secondary-300 bg-white/50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="visibility"
                                value={opt.value}
                                checked={formData.visibility === opt.value}
                                onChange={e => updateForm('visibility', e.target.value)}
                                className="sr-only"
                              />
                              <div className="flex items-center gap-2 mb-1">
                                <opt.icon className={`w-4 h-4 ${formData.visibility === opt.value ? 'text-primary-600' : 'text-secondary-400'}`} />
                                <span className={`text-sm font-medium ${formData.visibility === opt.value ? 'text-primary-700' : 'text-secondary-700'}`}>
                                  {opt.label}
                                </span>
                              </div>
                              <p className="text-xs text-secondary-400">{opt.desc}</p>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="flex flex-col sm:flex-row gap-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div
                            className={`relative w-11 h-6 rounded-full transition-colors ${formData.sealed_bid ? 'bg-primary-600' : 'bg-secondary-200'}`}
                            onClick={() => updateForm('sealed_bid', !formData.sealed_bid)}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.sealed_bid ? 'translate-x-5' : ''}`}
                            />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-secondary-700">Sealed Bid</span>
                            <p className="text-xs text-secondary-400">Quotes hidden until deadline</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <div
                            className={`relative w-11 h-6 rounded-full transition-colors ${formData.nda_required ? 'bg-primary-600' : 'bg-secondary-200'}`}
                            onClick={() => updateForm('nda_required', !formData.nda_required)}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.nda_required ? 'translate-x-5' : ''}`}
                            />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-secondary-700">NDA Required</span>
                            <p className="text-xs text-secondary-400">Suppliers must sign NDA</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: LINE ITEMS ────────────────────────────────── */}
                {currentStep === 1 && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-bold text-secondary-900 font-display">Line Items</h2>
                      <button
                        onClick={() => setShowAIGenerate(!showAIGenerate)}
                        className={`${dashboardTheme.buttons.outlined} flex items-center gap-2`}
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Generate
                      </button>
                    </div>

                    {/* AI Generate Section */}
                    {showAIGenerate && (
                      <div className="mb-6 p-4 bg-purple-50/50 border border-purple-200 rounded-xl">
                        <p className="text-sm font-medium text-purple-800 mb-2">Describe what you need and AI will generate line items</p>
                        <textarea
                          value={aiGeneratePrompt}
                          onChange={e => setAiGeneratePrompt(e.target.value)}
                          rows={3}
                          placeholder="e.g., I need 500 stainless steel bolts M10x50, 200 hex nuts M10, and 100 flat washers M10 for an automotive assembly project"
                          className={`${dashboardTheme.forms.textarea} mb-3`}
                        />
                        <div className="flex items-center justify-between">
                          <button onClick={() => setShowAIGenerate(false)} className="text-sm text-secondary-500 hover:text-secondary-700">
                            Cancel
                          </button>
                          <button
                            onClick={handleAIGenerate}
                            disabled={aiGenerating || !aiGeneratePrompt.trim()}
                            className={`${aiGenerating || !aiGeneratePrompt.trim() ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary} flex items-center gap-2`}
                          >
                            {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {aiGenerating ? 'Generating...' : 'Generate'}
                          </button>
                        </div>
                      </div>
                    )}

                    {errors.lineItems && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {errors.lineItems}
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-secondary-200">
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 w-12">#</th>
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 min-w-[180px]">Description</th>
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 w-28">Part No.</th>
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 w-20">Qty</th>
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 w-24">UOM</th>
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 w-32">Target Price</th>
                            <th className="text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider py-3 px-2 min-w-[120px]">Specs</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, idx) => (
                            <tr key={item.id} className="border-b border-secondary-100 last:border-0">
                              <td className="py-3 px-2 text-sm text-secondary-400 font-medium">{idx + 1}</td>
                              <td className="py-3 px-2">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                                  placeholder="Item description"
                                  className="w-full px-2 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white/50"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="text"
                                  value={item.part_number}
                                  onChange={e => updateLineItem(item.id, 'part_number', e.target.value)}
                                  placeholder="Optional"
                                  className="w-full px-2 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white/50"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={e => updateLineItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                                  min={1}
                                  className="w-full px-2 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white/50"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <select
                                  value={item.uom}
                                  onChange={e => updateLineItem(item.id, 'uom', e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white/50"
                                >
                                  {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="py-3 px-2">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-secondary-400">$</span>
                                  <input
                                    type="number"
                                    value={item.target_unit_price || ''}
                                    onChange={e => updateLineItem(item.id, 'target_unit_price', Math.max(0, Number(e.target.value)))}
                                    min={0}
                                    step={0.01}
                                    placeholder="0.00"
                                    className="w-full pl-6 pr-2 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white/50"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="text"
                                  value={item.specs}
                                  onChange={e => updateLineItem(item.id, 'specs', e.target.value)}
                                  placeholder="Specifications"
                                  className="w-full px-2 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white/50"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <button
                                  onClick={() => removeLineItem(item.id)}
                                  disabled={lineItems.length <= 1}
                                  className="p-1.5 text-secondary-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-secondary-400 transition-colors rounded-lg hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Add row + Total */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-secondary-100">
                      <button
                        onClick={addLineItem}
                        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Line Item
                      </button>
                      <div className="text-right">
                        <p className="text-xs text-secondary-500">Total Estimated Value</p>
                        <p className="text-lg font-bold text-secondary-900 font-display">
                          {formatCurrency(totalEstimatedValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: REQUIREMENTS ──────────────────────────────── */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {/* Certifications */}
                    <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                      <h2 className="text-lg font-bold text-secondary-900 font-display mb-4">Required Certifications</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {CERTIFICATIONS.map(cert => (
                          <label
                            key={cert}
                            className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedCerts.includes(cert)
                                ? 'border-primary-500 bg-primary-50/50'
                                : 'border-secondary-200 hover:border-secondary-300 bg-white/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCerts.includes(cert)}
                              onChange={() => toggleCert(cert)}
                              className={dashboardTheme.forms.checkbox}
                            />
                            <span className="text-sm text-secondary-700">{cert}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customCert}
                          onChange={e => setCustomCert(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomCert()}
                          placeholder="Add custom certification..."
                          className={`${dashboardTheme.forms.input} flex-1`}
                        />
                        <button onClick={addCustomCert} className={dashboardTheme.buttons.secondary}>
                          Add
                        </button>
                      </div>
                      {selectedCerts.filter(c => !CERTIFICATIONS.includes(c)).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {selectedCerts.filter(c => !CERTIFICATIONS.includes(c)).map(cert => (
                            <span
                              key={cert}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-medium"
                            >
                              {cert}
                              <button onClick={() => toggleCert(cert)} className="hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preferred Suppliers */}
                    <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                      <h2 className="text-lg font-bold text-secondary-900 font-display mb-4">Preferred Suppliers</h2>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                        <input
                          type="text"
                          value={supplierSearch}
                          onChange={e => setSupplierSearch(e.target.value)}
                          placeholder="Search suppliers..."
                          className={`${dashboardTheme.forms.input} pl-10`}
                        />
                        {searchingSuppliers && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 animate-spin" />
                        )}
                        {supplierResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-secondary-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                            {supplierResults.map(s => (
                              <button
                                key={s.id}
                                onClick={() => addSupplier(s)}
                                className="w-full px-4 py-3 text-left hover:bg-secondary-50 text-sm text-secondary-700 flex items-center gap-2 transition-colors first:rounded-t-xl last:rounded-b-xl"
                              >
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {s.name.charAt(0)}
                                </div>
                                <span className="flex-1 truncate">{s.name}</span>
                                {s.is_verified && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedSuppliers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedSuppliers.map(s => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-xs font-medium"
                            >
                              {s.name}
                              <button onClick={() => removeSupplier(s.id)} className="hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {selectedSuppliers.length === 0 && (
                        <p className="text-sm text-secondary-400">No preferred suppliers selected. Search above to add.</p>
                      )}
                    </div>

                    {/* Attachments */}
                    <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                      <h2 className="text-lg font-bold text-secondary-900 font-display mb-4">Attachments</h2>
                      <div
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-secondary-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                      >
                        <Upload className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-secondary-600">Drop files here or click to browse</p>
                        <p className="text-xs text-secondary-400 mt-1">Max 10 files, 25MB each</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>
                      {attachments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {attachments.map(att => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between p-3 bg-secondary-50 rounded-xl border border-secondary-100"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <FileText className="w-4 h-4 text-secondary-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm text-secondary-700 truncate">{att.file.name}</p>
                                  <p className="text-xs text-secondary-400">{formatFileSize(att.file.size)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeAttachment(att.id)}
                                className="p-1 text-secondary-400 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* NDA Upload */}
                      {formData.nda_required && (
                        <div className="mt-6 pt-6 border-t border-secondary-200">
                          <h3 className="text-sm font-semibold text-secondary-700 mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary-600" />
                            NDA Document
                          </h3>
                          {ndaFile ? (
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <p className="text-sm text-green-700 truncate">{ndaFile.file.name}</p>
                              </div>
                              <button
                                onClick={() => setNdaFile(null)}
                                className="p-1 text-green-600 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => ndaInputRef.current?.click()}
                              className={`${dashboardTheme.buttons.secondary} w-full flex items-center justify-center gap-2`}
                            >
                              <Upload className="w-4 h-4" />
                              Upload NDA Document
                            </button>
                          )}
                          <input
                            ref={ndaInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleNdaFile}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── STEP 4: REVIEW & PUBLISH ─────────────────────────── */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-secondary-900 font-display">Review Your RFP</h2>
                        <button
                          onClick={handleAISuggestImprovements}
                          className={`${dashboardTheme.buttons.outlined} flex items-center gap-2 text-sm`}
                        >
                          <Sparkles className="w-4 h-4" />
                          AI Suggest Improvements
                        </button>
                      </div>

                      <div className="space-y-6">
                        {/* Basic Info Section */}
                        <div>
                          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Basic Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-secondary-400">Title</p>
                              <p className="text-sm font-medium text-secondary-900">{formData.title || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-secondary-400">Category</p>
                              <p className="text-sm font-medium text-secondary-900">{formData.category || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-secondary-400">Deadline</p>
                              <p className="text-sm font-medium text-secondary-900">
                                {formData.deadline ? new Date(formData.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-secondary-400">Delivery Location</p>
                              <p className="text-sm font-medium text-secondary-900">{formData.delivery_location || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-secondary-400">Budget Range</p>
                              <p className="text-sm font-medium text-secondary-900">
                                {formData.budget_min || formData.budget_max
                                  ? `${formData.currency} ${formData.budget_min || '0'} – ${formData.budget_max || '∞'}`
                                  : 'Not specified'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-secondary-400">Visibility</p>
                              <p className="text-sm font-medium text-secondary-900 capitalize">{formData.visibility.replace('_', ' ')}</p>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-3">
                            {formData.sealed_bid && (
                              <span className={dashboardTheme.badges.info}>
                                <Lock className="w-3 h-3 inline mr-1" />Sealed Bid
                              </span>
                            )}
                            {formData.nda_required && (
                              <span className={dashboardTheme.badges.warning}>
                                <Shield className="w-3 h-3 inline mr-1" />NDA Required
                              </span>
                            )}
                          </div>
                          {formData.description && (
                            <div className="mt-4">
                              <p className="text-xs text-secondary-400 mb-1">Description</p>
                              <p className="text-sm text-secondary-700 whitespace-pre-wrap">{formData.description}</p>
                            </div>
                          )}
                        </div>

                        {/* Line Items Section */}
                        <div className="border-t border-secondary-100 pt-6">
                          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">
                            Line Items ({lineItems.filter(li => li.description.trim()).length})
                          </h3>
                          <div className={dashboardTheme.tables.container}>
                            <table className={dashboardTheme.tables.table}>
                              <thead className={dashboardTheme.tables.header}>
                                <tr>
                                  <th className={dashboardTheme.tables.headerCell}>#</th>
                                  <th className={dashboardTheme.tables.headerCell}>Description</th>
                                  <th className={dashboardTheme.tables.headerCell}>Part No.</th>
                                  <th className={dashboardTheme.tables.headerCell}>Qty</th>
                                  <th className={dashboardTheme.tables.headerCell}>UOM</th>
                                  <th className={dashboardTheme.tables.headerCell}>Target Price</th>
                                  <th className={dashboardTheme.tables.headerCell}>Specs</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lineItems.filter(li => li.description.trim()).map((item, idx) => (
                                  <tr key={item.id} className={dashboardTheme.tables.row}>
                                    <td className={dashboardTheme.tables.cell}>{idx + 1}</td>
                                    <td className={dashboardTheme.tables.cell}>{item.description}</td>
                                    <td className={dashboardTheme.tables.cell}>{item.part_number || '—'}</td>
                                    <td className={dashboardTheme.tables.cell}>{item.quantity}</td>
                                    <td className={dashboardTheme.tables.cell}>{item.uom}</td>
                                    <td className={dashboardTheme.tables.cell}>{item.target_unit_price ? formatCurrency(item.target_unit_price) : '—'}</td>
                                    <td className={dashboardTheme.tables.cell}>{item.specs || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-right mt-3">
                            <p className="text-sm text-secondary-500">Total Estimated Value: <span className="font-bold text-secondary-900">{formatCurrency(totalEstimatedValue)}</span></p>
                          </div>
                        </div>

                        {/* Requirements Section */}
                        <div className="border-t border-secondary-100 pt-6">
                          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Requirements</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-secondary-400 mb-2">Certifications</p>
                              {selectedCerts.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedCerts.map(c => (
                                    <span key={c} className={dashboardTheme.badges.primary}>{c}</span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-secondary-400">None specified</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-secondary-400 mb-2">Preferred Suppliers</p>
                              {selectedSuppliers.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedSuppliers.map(s => (
                                    <span key={s.id} className={dashboardTheme.badges.info}>{s.name}</span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-secondary-400">None specified</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Attachments Section */}
                        <div className="border-t border-secondary-100 pt-6">
                          <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">
                            Attachments ({attachments.length})
                          </h3>
                          {attachments.length > 0 ? (
                            <div className="space-y-2">
                              {attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-3 text-sm text-secondary-700">
                                  <FileText className="w-4 h-4 text-secondary-400" />
                                  <span>{att.file.name}</span>
                                  <span className="text-secondary-400">({formatFileSize(att.file.size)})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-secondary-400">No attachments</p>
                          )}
                          {ndaFile && (
                            <div className="mt-2 flex items-center gap-3 text-sm text-green-700">
                              <Shield className="w-4 h-4" />
                              <span>NDA: {ndaFile.file.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Publish CTAs */}
                    <div className={`${dashboardTheme.cards.primary} p-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
                      <p className="text-sm text-secondary-500">Ready to share your RFP with suppliers?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveDraft}
                          disabled={saving}
                          className={`${dashboardTheme.buttons.secondary} flex items-center gap-2`}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save as Draft
                        </button>
                        <button
                          onClick={() => setShowPublishModal(true)}
                          className={`${dashboardTheme.buttons.primary} flex items-center gap-2`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Publish RFP
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Bottom Navigation ─────────────────────────────────── */}
                <div className="flex items-center justify-between mt-8">
                  <button
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className={`${currentStep === 0 ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.secondary} flex items-center gap-2`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className={`${dashboardTheme.buttons.secondary} flex items-center gap-2`}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                  </button>

                  {currentStep < 3 && (
                    <button
                      onClick={handleNext}
                      className={`${dashboardTheme.buttons.primary} flex items-center gap-2`}
                    >
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {currentStep === 3 && <div />}
                </div>
              </div>

              {/* AI Sidebar */}
              <AISidebar
                step={currentStep}
                suggestions={aiSuggestions}
                onAccept={handleAcceptSuggestion}
                onDismiss={handleDismissSuggestion}
                loading={aiSidebarLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Publish Confirmation Modal ───────────────────────────────── */}
      {showPublishModal && (
        <div className={dashboardTheme.modals.overlay} onClick={() => setShowPublishModal(false)}>
          <div className={dashboardTheme.modals.container} onClick={e => e.stopPropagation()}>
            <div className={dashboardTheme.modals.header}>
              <h2 className="text-lg font-bold text-secondary-900 font-display">Publish RFP</h2>
              <p className="text-sm text-secondary-500 mt-1">
                Are you sure you want to publish &quot;{formData.title}&quot;? This will make it visible to suppliers based on your visibility settings.
              </p>
            </div>
            <div className={dashboardTheme.modals.body}>
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Before publishing, please verify:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>All line items are accurate</li>
                    <li>Deadline is realistic</li>
                    <li>Required certifications are correct</li>
                    <li>Attachments are complete</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className={dashboardTheme.modals.footer}>
              <button
                onClick={() => setShowPublishModal(false)}
                className={dashboardTheme.buttons.secondary}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className={`${dashboardTheme.buttons.primary} flex items-center gap-2`}
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {publishing ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewRFPPage;
