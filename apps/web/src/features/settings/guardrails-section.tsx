import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  CreateGuardRailInput,
  GuardRailDirection,
  GuardRailDto,
  GuardRailType
} from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const TYPE_LABELS: Record<GuardRailType, string> = {
  prompt_injection: 'Prompt injection',
  pii_mask: 'PII mask',
  scope: 'Scope',
  harmful_content: 'Harmful content'
};

const DIRECTION_LABELS: Record<GuardRailDirection, string> = {
  input: 'Input',
  output: 'Output',
  both: 'Input & output'
};

type FormState = {
  name: string;
  description: string;
  type: GuardRailType;
  direction: GuardRailDirection;
  enabled: boolean;
  priority: string;
  refusalMessage: string;
  keywords: string;
  patterns: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  type: 'prompt_injection',
  direction: 'input',
  enabled: true,
  priority: '100',
  refusalMessage: '',
  keywords: '',
  patterns: ''
});

function toForm(rail: GuardRailDto): FormState {
  return {
    name: rail.name,
    description: rail.description ?? '',
    type: rail.type,
    direction: rail.direction,
    enabled: rail.enabled,
    priority: String(rail.priority),
    refusalMessage: rail.config?.refusalMessage ?? '',
    keywords: (rail.config?.keywords ?? rail.config?.denyKeywords ?? []).join('\n'),
    patterns: (rail.config?.patterns ?? []).join('\n')
  };
}

function linesToList(value: string): string[] | undefined {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function formToPayload(form: FormState): CreateGuardRailInput {
  const keywords = linesToList(form.keywords);
  const patterns = linesToList(form.patterns);
  const config: CreateGuardRailInput['config'] = {};

  if (form.refusalMessage.trim()) config.refusalMessage = form.refusalMessage.trim();
  if (patterns) config.patterns = patterns;
  if (keywords) {
    if (form.type === 'scope') config.denyKeywords = keywords;
    else config.keywords = keywords;
  }

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    type: form.type,
    direction: form.direction,
    enabled: form.enabled,
    priority: Number(form.priority) || 100,
    config
  };
}

export function GuardrailsSection() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GuardRailDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const railsQuery = useQuery({
    queryKey: ['guardrails'],
    queryFn: () => api.listGuardrails()
  });

  const rails = useMemo(
    () => [...(railsQuery.data ?? [])].sort((a, b) => a.priority - b.priority),
    [railsQuery.data]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['guardrails'] });

  const createMutation = useMutation({
    mutationFn: (input: CreateGuardRailInput) => api.createGuardrail(input),
    onSuccess: () => {
      toast.success('Guard rail created');
      setDialogOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create guard rail')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateGuardRailInput }) =>
      api.updateGuardrail(id, input),
    onSuccess: () => {
      toast.success('Guard rail updated');
      setDialogOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update guard rail')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateGuardrail(id, { enabled }),
    onSuccess: (_data, variables) => {
      toast.success(variables.enabled ? 'Guard rail enabled' : 'Guard rail disabled');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update guard rail')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteGuardrail(id),
    onSuccess: () => {
      toast.success('Guard rail deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete guard rail')
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (rail: GuardRailDto) => {
    setEditing(rail);
    setForm(toForm(rail));
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const payload = formToPayload(form);
    if (editing) {
      updateMutation.mutate({ id: editing.id, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Guard Rails</CardTitle>
            <CardDescription>
              Filter chat input before RAG/LLM and sanitize or block model output. Managed on the
              server.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {railsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading guard rails…</p>
          )}
          {railsQuery.isError && (
            <p className="text-sm text-destructive">
              Could not load guard rails. Check the API base URL and that the server is running.
            </p>
          )}
          {!railsQuery.isLoading && !railsQuery.isError && rails.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No guard rails yet. Defaults seed automatically on first API start; click Add to
              create one.
            </p>
          )}
          {rails.map((rail) => (
            <div
              key={rail.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{rail.name}</p>
                  <Badge variant="secondary">{TYPE_LABELS[rail.type]}</Badge>
                  <Badge variant="outline">{DIRECTION_LABELS[rail.direction]}</Badge>
                  <span className="text-xs text-muted-foreground">priority {rail.priority}</span>
                </div>
                {rail.description && (
                  <p className="text-xs text-muted-foreground">{rail.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Switch
                  checked={rail.enabled}
                  onCheckedChange={(enabled) => toggleMutation.mutate({ id: rail.id, enabled })}
                  aria-label={`Toggle ${rail.name}`}
                />
                <Button variant="ghost" size="icon" onClick={() => openEdit(rail)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.confirm(`Delete “${rail.name}”?`)) {
                      deleteMutation.mutate(rail.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit guard rail' : 'Add guard rail'}</DialogTitle>
            <DialogDescription>
              Configure type, direction, and optional keywords or patterns (one per line).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="gr-name">Name</Label>
              <Input
                id="gr-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gr-description">Description</Label>
              <Input
                id="gr-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, type: value as GuardRailType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as GuardRailType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={form.direction}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, direction: value as GuardRailDirection }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DIRECTION_LABELS) as GuardRailDirection[]).map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {DIRECTION_LABELS[direction]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gr-priority">Priority</Label>
                <Input
                  id="gr-priority"
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Lower runs first.</p>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(enabled) => setForm((prev) => ({ ...prev, enabled }))}
                  id="gr-enabled"
                />
                <Label htmlFor="gr-enabled">Enabled</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gr-refusal">Refusal message</Label>
              <Textarea
                id="gr-refusal"
                rows={2}
                value={form.refusalMessage}
                onChange={(e) => setForm((prev) => ({ ...prev, refusalMessage: e.target.value }))}
                placeholder="Shown when this rail blocks a request"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gr-keywords">
                {form.type === 'scope' ? 'Deny keywords' : 'Keywords'} (one per line)
              </Label>
              <Textarea
                id="gr-keywords"
                rows={3}
                value={form.keywords}
                onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))}
                placeholder="Optional overrides; leave empty to use built-in defaults"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gr-patterns">Patterns / regex (one per line)</Label>
              <Textarea
                id="gr-patterns"
                rows={3}
                value={form.patterns}
                onChange={(e) => setForm((prev) => ({ ...prev, patterns: e.target.value }))}
                placeholder="Optional; invalid regex falls back to literal match"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
