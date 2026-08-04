import { useState } from 'react';
import { FiBookOpen, FiBriefcase, FiCompass, FiFileText, FiPlus, FiShield, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Button, IconButton, Input, SectionCard, Skeleton, StringListEditor } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import {
  businessProfileService,
  type BusinessProfile,
  type BusinessProfileFaq,
  type UpsertBusinessProfilePayload,
} from '@/services/businessProfileService';
import styles from '../business-knowledge.module.css';

function FaqListEditor({ faqs, onChange }: { faqs: BusinessProfileFaq[]; onChange: (faqs: BusinessProfileFaq[]) => void }) {
  return (
    <div>
      <span className={styles.fieldLabel}>FAQs</span>
      <div className={styles.formGrid}>
        {faqs.map((faq, index) => (
          <div key={index} className={styles.faqRow}>
            <Input
              label="Question"
              value={faq.question}
              onChange={(e) => onChange(faqs.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))}
            />
            <Input
              label="Answer"
              value={faq.answer}
              onChange={(e) => onChange(faqs.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)))}
            />
            <div className={styles.faqRowHead}>
              <IconButton icon={<FiX />} label="Remove FAQ" size="sm" onClick={() => onChange(faqs.filter((_, i) => i !== index))} />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<FiPlus />}
          onClick={() => onChange([...faqs, { question: '', answer: '' }])}
        >
          Add FAQ
        </Button>
      </div>
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <div>
      <span className={styles.fieldLabel}>{label}</span>
      <textarea className={styles.textarea} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function BusinessProfileForm({
  profile,
  isLoading,
  canEdit,
  onSaved,
}: {
  profile: BusinessProfile | undefined;
  isLoading: boolean;
  canEdit: boolean;
  onSaved: (profile: BusinessProfile) => void;
}) {
  const [draft, setDraft] = useState<BusinessProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const working = draft ?? profile;

  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => {
    if (!working) return;
    setDraft({ ...working, [key]: value });
  };

  const handleSave = async () => {
    if (!working) return;
    setSaving(true);
    try {
      const payload: UpsertBusinessProfilePayload = {
        businessName: working.businessName,
        description: working.description,
        industry: working.industry,
        website: working.website,
        branches: working.branches,
        products: working.products,
        services: working.services,
        brands: working.brands,
        pricingPolicies: working.pricingPolicies,
        salesProcess: working.salesProcess,
        customerJourney: working.customerJourney,
        targetAudience: working.targetAudience,
        vision: working.vision,
        mission: working.mission,
        values: working.values,
        faqs: working.faqs,
        termsAndConditions: working.termsAndConditions,
        warrantyPolicy: working.warrantyPolicy,
        refundPolicy: working.refundPolicy,
        shippingPolicy: working.shippingPolicy,
        businessRules: working.businessRules,
        standardOperatingProcedures: working.standardOperatingProcedures,
        salesGuidelines: working.salesGuidelines,
        marketingGuidelines: working.marketingGuidelines,
        internalPolicies: working.internalPolicies,
      };
      const saved = await businessProfileService.upsert(payload);
      setDraft(null);
      onSaved(saved);
      toast.success('Business profile saved — the AI can use this right away');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !working) {
    return (
      <div className={styles.tabContent}>
        <Skeleton height={100} />
        <Skeleton height={220} />
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.completenessRow}>
        <span>Profile completeness: {working.completenessPct}%</span>
        <div className={styles.completenessTrack}>
          <div className={styles.completenessFill} style={{ width: `${working.completenessPct}%` }} />
        </div>
      </div>

      <SectionCard title="Identity" icon={FiBookOpen}>
        <div className={styles.formGrid}>
          <div className={styles.twoColumn}>
            <Input label="Business Name" value={working.businessName ?? ''} disabled={!canEdit} onChange={(e) => set('businessName', e.target.value)} />
            <Input label="Industry" value={working.industry ?? ''} disabled={!canEdit} onChange={(e) => set('industry', e.target.value)} />
          </div>
          <Input label="Website" value={working.website ?? ''} disabled={!canEdit} onChange={(e) => set('website', e.target.value)} />
          <TextAreaField label="Description" value={working.description} onChange={(v) => set('description', v)} />
          <StringListEditor label="Branches / Locations" items={working.branches} onChange={(v) => set('branches', v)} addLabel="Add branch" />
        </div>
      </SectionCard>

      <SectionCard title="Offering" icon={FiBriefcase}>
        <div className={styles.formGrid}>
          <StringListEditor label="Products" items={working.products} onChange={(v) => set('products', v)} addLabel="Add product" />
          <StringListEditor label="Services" items={working.services} onChange={(v) => set('services', v)} addLabel="Add service" />
          <StringListEditor label="Brands" items={working.brands} onChange={(v) => set('brands', v)} addLabel="Add brand" />
        </div>
      </SectionCard>

      <SectionCard title="Commercial Process" icon={FiCompass}>
        <div className={styles.formGrid}>
          <TextAreaField label="Pricing Policies" value={working.pricingPolicies} onChange={(v) => set('pricingPolicies', v)} />
          <TextAreaField label="Sales Process" value={working.salesProcess} onChange={(v) => set('salesProcess', v)} />
          <TextAreaField label="Customer Journey" value={working.customerJourney} onChange={(v) => set('customerJourney', v)} />
          <TextAreaField label="Target Audience" value={working.targetAudience} onChange={(v) => set('targetAudience', v)} />
        </div>
      </SectionCard>

      <SectionCard title="Culture & FAQs" icon={FiFileText}>
        <div className={styles.formGrid}>
          <div className={styles.twoColumn}>
            <TextAreaField label="Vision" value={working.vision} onChange={(v) => set('vision', v)} />
            <TextAreaField label="Mission" value={working.mission} onChange={(v) => set('mission', v)} />
          </div>
          <StringListEditor label="Values" items={working.values} onChange={(v) => set('values', v)} addLabel="Add value" />
          <FaqListEditor faqs={working.faqs} onChange={(v) => set('faqs', v)} />
        </div>
      </SectionCard>

      <SectionCard title="Policies" icon={FiShield}>
        <div className={styles.formGrid}>
          <TextAreaField label="Terms & Conditions" value={working.termsAndConditions} onChange={(v) => set('termsAndConditions', v)} />
          <div className={styles.twoColumn}>
            <TextAreaField label="Warranty Policy" value={working.warrantyPolicy} onChange={(v) => set('warrantyPolicy', v)} />
            <TextAreaField label="Refund Policy" value={working.refundPolicy} onChange={(v) => set('refundPolicy', v)} />
          </div>
          <TextAreaField label="Shipping Policy" value={working.shippingPolicy} onChange={(v) => set('shippingPolicy', v)} />
        </div>
      </SectionCard>

      <SectionCard title="Operating Guidance" icon={FiFileText}>
        <div className={styles.formGrid}>
          <TextAreaField label="Business Rules" value={working.businessRules} onChange={(v) => set('businessRules', v)} />
          <TextAreaField label="Standard Operating Procedures" value={working.standardOperatingProcedures} onChange={(v) => set('standardOperatingProcedures', v)} />
          <TextAreaField label="Sales Guidelines" value={working.salesGuidelines} onChange={(v) => set('salesGuidelines', v)} />
          <TextAreaField label="Marketing Guidelines" value={working.marketingGuidelines} onChange={(v) => set('marketingGuidelines', v)} />
          <TextAreaField label="Internal Policies" value={working.internalPolicies} onChange={(v) => set('internalPolicies', v)} />
        </div>
      </SectionCard>

      {canEdit && (
        <div>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save Business Profile'}
          </Button>
        </div>
      )}
    </div>
  );
}
