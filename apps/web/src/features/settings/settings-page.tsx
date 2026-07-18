import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DEFAULT_PREFERENCES,
  useUiStore,
  type ThemeMode,
  type VideoView
} from '@/stores/ui-store';

const PAGE_SIZE_OPTIONS = [6, 9, 12, 24, 48];

export function SettingsPage() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const videoView = useUiStore((state) => state.videoView);
  const setVideoView = useUiStore((state) => state.setVideoView);
  const pageSize = useUiStore((state) => state.pageSize);
  const setPageSize = useUiStore((state) => state.setPageSize);
  const apiBaseUrl = useUiStore((state) => state.apiBaseUrl);
  const setApiBaseUrl = useUiStore((state) => state.setApiBaseUrl);
  const defaultChatModel = useUiStore((state) => state.defaultChatModel);
  const setDefaultChatModel = useUiStore((state) => state.setDefaultChatModel);
  const resetPreferences = useUiStore((state) => state.resetPreferences);

  const [apiDraft, setApiDraft] = useState(apiBaseUrl);

  const modelsQuery = useQuery({
    queryKey: ['llm-models'],
    queryFn: () => api.listLlmModels()
  });

  useEffect(() => {
    if (!modelsQuery.data) return;
    const { defaultModel, models } = modelsQuery.data;
    const ids = models.map((model) => model.id);
    if (!defaultChatModel || !ids.includes(defaultChatModel)) {
      setDefaultChatModel(defaultModel);
    }
  }, [modelsQuery.data, defaultChatModel, setDefaultChatModel]);

  const saveApi = () => {
    const trimmed = apiDraft.trim();
    if (trimmed && !/^https?:\/\//.test(trimmed)) {
      toast.error('API base URL must start with http:// or https://');
      return;
    }
    setApiBaseUrl(trimmed || DEFAULT_PREFERENCES.apiBaseUrl);
    toast.success('API base URL saved');
  };

  const handleReset = () => {
    resetPreferences();
    setApiDraft(DEFAULT_PREFERENCES.apiBaseUrl);
    if (modelsQuery.data?.defaultModel) {
      setDefaultChatModel(modelsQuery.data.defaultModel);
    }
    toast.success('Preferences reset to defaults');
  };

  const selectedModel = defaultChatModel || modelsQuery.data?.defaultModel || '';

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Preferences are stored locally in your browser.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Control theme and default list layout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Theme" hint="System follows your OS preference.">
            <Select value={theme} onValueChange={(value) => setTheme(value as ThemeMode)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Default video view" hint="Card grid or table layout.">
            <Select value={videoView} onValueChange={(value) => setVideoView(value as VideoView)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Videos per page" hint="Items loaded per page.">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LLM</CardTitle>
          <CardDescription>
            Default model for video chat. Summarization uses the server default from{' '}
            <code className="text-xs">.env</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow label="Default chat model" hint="Used when you open chat; you can still switch per message.">
            <Select
              value={selectedModel}
              onValueChange={(value) => {
                setDefaultChatModel(value);
                toast.success(`Default chat model set to ${value}`);
              }}
              disabled={!modelsQuery.data || modelsQuery.isLoading}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={modelsQuery.isLoading ? 'Loading…' : 'Select model'} />
              </SelectTrigger>
              <SelectContent>
                {(modelsQuery.data?.models ?? []).map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          {modelsQuery.isError && (
            <p className="mt-3 text-xs text-destructive">
              Could not load models from the API. Check the API base URL and that the server is running.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>Where the web app sends API requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="api-base">API base URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="api-base"
              value={apiDraft}
              onChange={(e) => setApiDraft(e.target.value)}
              placeholder={DEFAULT_PREFERENCES.apiBaseUrl}
            />
            <Button onClick={saveApi} disabled={apiDraft.trim() === apiBaseUrl.trim()}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: {DEFAULT_PREFERENCES.apiBaseUrl}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function SettingRow({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
