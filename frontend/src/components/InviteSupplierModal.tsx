import React, { useState, useCallback } from 'react';
import { Search, X, Building2, MapPin, CheckCircle, Loader2, Send } from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme } from '@/styles/dashboardTheme';

interface SupplierResult {
  id: string;
  name: string;
  industry?: string;
  headquarters_location?: string;
  verified: boolean;
}

interface InviteSupplierModalProps {
  rfqId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteSupplierModal: React.FC<InviteSupplierModalProps> = ({
  rfqId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SupplierResult[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<SupplierResult[]>([]);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeout) clearTimeout(searchTimeout);

      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      const timeout = setTimeout(async () => {
        setSearching(true);
        try {
          const response = await api.get(`/api/v1/companies/search`, {
            params: { q: query },
          });
          const results: SupplierResult[] = response.data.companies || response.data || [];
          // Filter out already-selected suppliers
          const selectedIds = new Set(selectedSuppliers.map((s) => s.id));
          setSearchResults(results.filter((r) => !selectedIds.has(r.id)));
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      }, 350);

      setSearchTimeout(timeout);
    },
    [searchTimeout, selectedSuppliers],
  );

  const addSupplier = (supplier: SupplierResult) => {
    setSelectedSuppliers((prev) => [...prev, supplier]);
    setSearchResults((prev) => prev.filter((r) => r.id !== supplier.id));
  };

  const removeSupplier = (id: string) => {
    setSelectedSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSendInvitations = async () => {
    if (selectedSuppliers.length === 0) return;
    setSending(true);
    try {
      await Promise.all(
        selectedSuppliers.map((supplier) =>
          api.post(`/api/v1/rfqs/${rfqId}/invite`, {
            supplier_company_id: supplier.id,
            message,
          }),
        ),
      );
      setSent(true);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch {
      // Error toast handled by api interceptor
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSuppliers([]);
    setMessage('');
    setSent(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={dashboardTheme.modals.overlay} onClick={handleClose}>
      <div
        className={`${dashboardTheme.modals.container} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={dashboardTheme.modals.header}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-secondary-900 font-display">
                Invite Suppliers
              </h2>
              <p className="text-sm text-secondary-500 mt-1">
                Search and invite suppliers to respond to your RFQ
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`${dashboardTheme.modals.body} flex-1 overflow-y-auto space-y-6`}>
          {sent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">
                Invitations Sent!
              </h3>
              <p className="text-sm text-secondary-500">
                {selectedSuppliers.length} supplier{selectedSuppliers.length > 1 ? 's' : ''} invited
                successfully.
              </p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div>
                <label className={dashboardTheme.forms.label}>Search Companies</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Search by company name, industry..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className={`${dashboardTheme.forms.input} pl-10`}
                  />
                  {searching && (
                    <Loader2 className="absolute right-3.5 top-3.5 w-4 h-4 text-secondary-400 animate-spin" />
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-secondary-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((supplier) => (
                      <button
                        key={supplier.id}
                        onClick={() => addSupplier(supplier)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary-50 border-b border-secondary-100 last:border-0 transition-colors"
                      >
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-secondary-900 truncate">
                              {supplier.name}
                            </span>
                            {supplier.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-secondary-500 mt-0.5">
                            {supplier.industry && <span>{supplier.industry}</span>}
                            {supplier.headquarters_location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {supplier.headquarters_location}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-secondary-400 mt-2 pl-1">
                    No companies found matching &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>

              {/* Selected Suppliers */}
              {selectedSuppliers.length > 0 && (
                <div>
                  <label className={dashboardTheme.forms.label}>
                    Selected Suppliers ({selectedSuppliers.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSuppliers.map((supplier) => (
                      <span
                        key={supplier.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-lg text-sm font-medium"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {supplier.name}
                        <button
                          onClick={() => removeSupplier(supplier.id)}
                          className="ml-0.5 p-0.5 hover:bg-primary-100 rounded transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <label className={dashboardTheme.forms.label}>
                  Invitation Message{' '}
                  <span className="text-secondary-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Add a personal message to accompany the invitation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={dashboardTheme.forms.textarea}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className={dashboardTheme.modals.footer}>
            <button onClick={handleClose} className={dashboardTheme.buttons.secondary}>
              Cancel
            </button>
            <button
              onClick={handleSendInvitations}
              disabled={selectedSuppliers.length === 0 || sending}
              className={
                selectedSuppliers.length === 0 || sending
                  ? dashboardTheme.buttons.disabled
                  : dashboardTheme.buttons.primary
              }
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send Invitation{selectedSuppliers.length > 1 ? 's' : ''} ({selectedSuppliers.length})
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteSupplierModal;
