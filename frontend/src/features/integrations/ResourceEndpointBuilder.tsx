import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiChevronDown, FiChevronRight, FiPlay, FiPlus, FiTrash2 } from 'react-icons/fi';
import { Badge, Button, Input, Modal } from '@/components/ui';
import {
  integrationsService,
  type EndpointQueryParam,
  type EndpointTestResult,
  type HttpMethod,
  type IntegrationEndpoint,
  type IntegrationResource,
} from '@/services/integrationsService';
import { extractErrorMessage } from '@/utils/errors';
import pageStyles from './IntegrationsPage.module.css';
import styles from './ResourceEndpointBuilder.module.css';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const KEY_HINT = 'lowercase letters/numbers, dashes or underscores';

// "Header: value" per line — same convention already used for customHeaders
// in IntegrationsPage.tsx, reused here for endpoint static headers.
function parseLines(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (name) result[name] = value;
  }
  return result;
}

function parseJsonOrNull(text: string, label: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

interface QueryParamsEditorProps {
  items: EndpointQueryParam[];
  onChange: (items: EndpointQueryParam[]) => void;
}

// Small row-list editor for endpoint query params — modeled on
// components/ui/StringListEditor.tsx, but each row is {name, required}
// rather than a bare string.
function QueryParamsEditor({ items, onChange }: QueryParamsEditorProps) {
  return (
    <div className={styles.formGrid}>
      <span className={pageStyles.fieldLabel}>Query params</span>
      {items.map((item, index) => (
        <div key={index} className={styles.paramRow}>
          <Input
            placeholder="param name"
            value={item.name}
            onChange={(e) => onChange(items.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))}
          />
          <label className={styles.muted} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={!!item.required}
              onChange={(e) => onChange(items.map((it, i) => (i === index ? { ...it, required: e.target.checked } : it)))}
            />
            required
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <FiTrash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={<FiPlus />}
        onClick={() => onChange([...items, { name: '', required: false }])}
      >
        Add query param
      </Button>
    </div>
  );
}

interface EndpointFormState {
  name: string;
  key: string;
  method: HttpMethod;
  path: string;
  description: string;
  queryParams: EndpointQueryParam[];
  headersText: string;
  requestBodySchemaText: string;
}

const EMPTY_ENDPOINT_FORM: EndpointFormState = {
  name: '',
  key: '',
  method: 'GET',
  path: '',
  description: '',
  queryParams: [],
  headersText: '',
  requestBodySchemaText: '',
};

interface TestFormState {
  pathParamsText: string;
  queryText: string;
  bodyText: string;
}

const EMPTY_TEST_FORM: TestFormState = { pathParamsText: '{}', queryText: '{}', bodyText: '' };

export interface ResourceEndpointBuilderProps {
  provider: string;
  open: boolean;
  onClose: () => void;
}

// The metadata builder for the API Integration Engine — configure unlimited
// resources and endpoints for a connected integration, each run through the
// backend's one generic Dynamic Executor (dynamic-executor.service.ts).
// Deliberately JSON-textarea based for request bodies/test payloads rather
// than a typed drag-and-drop field builder — see the plan's "Why a JSON
// textarea" note: it covers arbitrary/nested JSON Schema at a fraction of
// the UI complexity, and admins configuring a real CRM/SaaS API already
// think in terms of that API's actual JSON shapes.
export function ResourceEndpointBuilder({ provider, open, onClose }: ResourceEndpointBuilderProps) {
  const [resources, setResources] = useState<IntegrationResource[]>([]);
  const [endpointsByResource, setEndpointsByResource] = useState<Record<string, IntegrationEndpoint[]>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showAddResource, setShowAddResource] = useState(false);
  const [resourceName, setResourceName] = useState('');
  const [resourceKey, setResourceKey] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [savingResource, setSavingResource] = useState(false);

  const [addingEndpointFor, setAddingEndpointFor] = useState<string | null>(null);
  const [endpointForm, setEndpointForm] = useState<EndpointFormState>(EMPTY_ENDPOINT_FORM);
  const [savingEndpoint, setSavingEndpoint] = useState(false);

  // "<resourceKey>:<endpointKey>" while a test panel is open, so only one
  // endpoint's test form is expanded at a time.
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [testForm, setTestForm] = useState<TestFormState>(EMPTY_TEST_FORM);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);
  const [runningTest, setRunningTest] = useState(false);

  const loadResources = () => {
    setLoading(true);
    integrationsService
      .listResources(provider)
      .then(setResources)
      .catch((error) => toast.error(extractErrorMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    loadResources();
    setExpandedKey(null);
    setShowAddResource(false);
    setAddingEndpointFor(null);
    setTestingEndpoint(null);
  }, [open, provider]);

  const loadEndpoints = (key: string) => {
    integrationsService
      .listEndpoints(provider, key)
      .then((endpoints) => setEndpointsByResource((prev) => ({ ...prev, [key]: endpoints })))
      .catch((error) => toast.error(extractErrorMessage(error)));
  };

  const toggleResource = (key: string) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (!endpointsByResource[key]) loadEndpoints(key);
  };

  const handleAddResource = async () => {
    if (!resourceName.trim() || !resourceKey.trim()) {
      toast.error('Name and key are required.');
      return;
    }
    setSavingResource(true);
    try {
      await integrationsService.createResource(provider, {
        name: resourceName.trim(),
        key: resourceKey.trim().toLowerCase(),
        description: resourceDescription.trim() || undefined,
      });
      toast.success(`Resource "${resourceName}" added`);
      setShowAddResource(false);
      setResourceName('');
      setResourceKey('');
      setResourceDescription('');
      loadResources();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSavingResource(false);
    }
  };

  const handleDeleteResource = async (key: string) => {
    try {
      await integrationsService.deleteResource(provider, key);
      toast.success('Resource deleted');
      loadResources();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleAddEndpoint = async (resKey: string) => {
    if (!endpointForm.name.trim() || !endpointForm.key.trim() || !endpointForm.path.trim()) {
      toast.error('Name, key, and path are required.');
      return;
    }
    let requestBodySchema: Record<string, unknown> | undefined;
    try {
      requestBodySchema = parseJsonOrNull(endpointForm.requestBodySchemaText, 'Request body schema');
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    const headers = parseLines(endpointForm.headersText);

    setSavingEndpoint(true);
    try {
      await integrationsService.createEndpoint(provider, resKey, {
        name: endpointForm.name.trim(),
        key: endpointForm.key.trim().toLowerCase(),
        method: endpointForm.method,
        path: endpointForm.path.trim(),
        description: endpointForm.description.trim() || undefined,
        queryParams: endpointForm.queryParams.filter((q) => q.name.trim()),
        headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
        requestBodySchema,
      });
      toast.success(`Endpoint "${endpointForm.name}" added`);
      setAddingEndpointFor(null);
      setEndpointForm(EMPTY_ENDPOINT_FORM);
      loadEndpoints(resKey);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSavingEndpoint(false);
    }
  };

  const handleDeleteEndpoint = async (resKey: string, endpointKey: string) => {
    try {
      await integrationsService.deleteEndpoint(provider, resKey, endpointKey);
      toast.success('Endpoint deleted');
      loadEndpoints(resKey);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const openTestPanel = (resKey: string, endpointKey: string) => {
    const id = `${resKey}:${endpointKey}`;
    setTestingEndpoint(testingEndpoint === id ? null : id);
    setTestForm(EMPTY_TEST_FORM);
    setTestResult(null);
  };

  const handleRunTest = async (resKey: string, endpointKey: string) => {
    let pathParams: Record<string, unknown> | undefined;
    let query: Record<string, unknown> | undefined;
    let body: unknown;
    try {
      pathParams = parseJsonOrNull(testForm.pathParamsText, 'Path params');
      query = parseJsonOrNull(testForm.queryText, 'Query');
      body = testForm.bodyText.trim() ? JSON.parse(testForm.bodyText) : undefined;
    } catch (error) {
      toast.error((error as Error).message || 'Body must be valid JSON.');
      return;
    }

    setRunningTest(true);
    setTestResult(null);
    try {
      const result = await integrationsService.testEndpoint(provider, resKey, endpointKey, {
        pathParams: pathParams as Record<string, string> | undefined,
        query: query as Record<string, string> | undefined,
        body,
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({ ok: false, message: extractErrorMessage(error) });
    } finally {
      setRunningTest(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Resources & Endpoints — ${provider}`}
      description="Configure any number of resources and REST actions for this integration. Every action runs through one generic executor — no provider-specific code."
      maxWidth={720}
    >
      <div className={pageStyles.accountList}>
        {loading && <p className={pageStyles.cardDescription}>Loading...</p>}

        {!loading && resources.length === 0 && !showAddResource && (
          <p className={pageStyles.cardDescription}>
            No resources configured yet. Add one (e.g. "Contacts", "Deals") to start defining endpoints.
          </p>
        )}

        {resources.map((resource) => {
          const isOpen = expandedKey === resource.key;
          const endpoints = endpointsByResource[resource.key] ?? [];
          return (
            <div key={resource.key} className={styles.resourceCard}>
              <div className={styles.resourceHeader} onClick={() => toggleResource(resource.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                  <div>
                    <div className={styles.resourceName}>{resource.name}</div>
                    <div className={styles.resourceMeta}>
                      {resource.key}
                      {resource.description ? ` · ${resource.description}` : ''}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<FiTrash2 />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteResource(resource.key);
                  }}
                >
                  Delete
                </Button>
              </div>

              {isOpen && (
                <div className={styles.resourceBody}>
                  {endpoints.map((endpoint) => {
                    const id = `${resource.key}:${endpoint.key}`;
                    return (
                      <div key={endpoint.key} className={styles.endpointRow}>
                        <div className={styles.endpointHeader}>
                          <span className={styles.methodBadge}>{endpoint.method}</span>
                          <span className={styles.pathText}>{endpoint.path}</span>
                          <Button size="sm" variant="ghost" leftIcon={<FiPlay />} onClick={() => openTestPanel(resource.key, endpoint.key)}>
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<FiTrash2 />}
                            onClick={() => handleDeleteEndpoint(resource.key, endpoint.key)}
                          >
                            Delete
                          </Button>
                        </div>
                        {endpoint.description && <span className={styles.muted}>{endpoint.description}</span>}

                        {testingEndpoint === id && (
                          <div className={styles.formGrid}>
                            <span className={pageStyles.fieldLabel}>Path params (JSON)</span>
                            <textarea
                              className={styles.jsonTextarea}
                              value={testForm.pathParamsText}
                              onChange={(e) => setTestForm((f) => ({ ...f, pathParamsText: e.target.value }))}
                            />
                            <span className={pageStyles.fieldLabel}>Query (JSON)</span>
                            <textarea
                              className={styles.jsonTextarea}
                              value={testForm.queryText}
                              onChange={(e) => setTestForm((f) => ({ ...f, queryText: e.target.value }))}
                            />
                            {(endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH') && (
                              <>
                                <span className={pageStyles.fieldLabel}>Body (JSON)</span>
                                <textarea
                                  className={styles.jsonTextarea}
                                  value={testForm.bodyText}
                                  onChange={(e) => setTestForm((f) => ({ ...f, bodyText: e.target.value }))}
                                />
                              </>
                            )}
                            <Button
                              size="sm"
                              loading={runningTest}
                              onClick={() => handleRunTest(resource.key, endpoint.key)}
                            >
                              Run Test
                            </Button>
                            {testResult && (
                              <div className={testResult.ok ? pageStyles.testResultOk : pageStyles.testResultFail}>
                                {testResult.statusCode && <Badge variant={testResult.ok ? 'success' : 'danger'}>HTTP {testResult.statusCode}</Badge>}{' '}
                                {testResult.message}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingEndpointFor === resource.key ? (
                    <div className={styles.formGrid}>
                      <Input
                        label="Endpoint name"
                        placeholder="e.g. Assign Lead"
                        value={endpointForm.name}
                        onChange={(e) => setEndpointForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <Input
                        label="Key"
                        hint={KEY_HINT}
                        placeholder="e.g. assign"
                        value={endpointForm.key}
                        onChange={(e) => setEndpointForm((f) => ({ ...f, key: e.target.value }))}
                      />
                      <div>
                        <span className={pageStyles.fieldLabel}>Method</span>
                        <select
                          className={pageStyles.select}
                          value={endpointForm.method}
                          onChange={(e) => setEndpointForm((f) => ({ ...f, method: e.target.value as HttpMethod }))}
                        >
                          {HTTP_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Path"
                        hint="Relative to the integration's base URL. Use {param} for path variables, e.g. /leads/{id}/assign"
                        placeholder="/leads/{id}/assign"
                        value={endpointForm.path}
                        onChange={(e) => setEndpointForm((f) => ({ ...f, path: e.target.value }))}
                      />
                      <Input
                        label="Description (optional)"
                        value={endpointForm.description}
                        onChange={(e) => setEndpointForm((f) => ({ ...f, description: e.target.value }))}
                      />
                      <QueryParamsEditor
                        items={endpointForm.queryParams}
                        onChange={(items) => setEndpointForm((f) => ({ ...f, queryParams: items }))}
                      />
                      <div>
                        <span className={pageStyles.fieldLabel}>Static headers (one "Name: value" per line, optional)</span>
                        <textarea
                          className={styles.jsonTextarea}
                          placeholder={'X-Custom-Header: value'}
                          value={endpointForm.headersText}
                          onChange={(e) => setEndpointForm((f) => ({ ...f, headersText: e.target.value }))}
                        />
                      </div>
                      <div>
                        <span className={pageStyles.fieldLabel}>Request body JSON Schema (optional)</span>
                        <textarea
                          className={styles.jsonTextarea}
                          placeholder='{"type": "object", "properties": {"name": {"type": "string"}}}'
                          value={endpointForm.requestBodySchemaText}
                          onChange={(e) => setEndpointForm((f) => ({ ...f, requestBodySchemaText: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button variant="ghost" onClick={() => setAddingEndpointFor(null)}>
                          Cancel
                        </Button>
                        <Button loading={savingEndpoint} onClick={() => handleAddEndpoint(resource.key)}>
                          Save Endpoint
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<FiPlus />}
                      onClick={() => {
                        setAddingEndpointFor(resource.key);
                        setEndpointForm(EMPTY_ENDPOINT_FORM);
                      }}
                    >
                      Add Endpoint
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {showAddResource ? (
          <div className={styles.formGrid}>
            <Input label="Resource name" placeholder="e.g. Contacts" value={resourceName} onChange={(e) => setResourceName(e.target.value)} autoFocus />
            <Input label="Key" hint={KEY_HINT} placeholder="e.g. contacts" value={resourceKey} onChange={(e) => setResourceKey(e.target.value)} />
            <Input
              label="Description (optional)"
              value={resourceDescription}
              onChange={(e) => setResourceDescription(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="ghost" onClick={() => setShowAddResource(false)}>
                Cancel
              </Button>
              <Button loading={savingResource} onClick={handleAddResource}>
                Save Resource
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" leftIcon={<FiPlus />} onClick={() => setShowAddResource(true)}>
            Add Resource
          </Button>
        )}
      </div>
    </Modal>
  );
}
