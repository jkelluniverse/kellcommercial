import React, { useState } from "react";
import { api } from "../lib/api";
import { PageHeader, Card, Empty } from "../components/UI";
import { Search, FileText, ExternalLink, Folder } from "lucide-react";

export default function Documents() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      const { data } = await api.get("/documents/search", { params: { q: q.trim() } });
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Knowledge" title="Documents">
        Search the Kell Commercial Drive folder and any nested subfolders.
      </PageHeader>

      <div className="p-6 md:p-10 space-y-6">
        <form data-testid="docs-search-form" onSubmit={search} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search size={14} className="absolute top-3 left-3 text-ink-500" />
            <input
              data-testid="docs-search-input"
              className="input pl-9"
              placeholder="Search by filename or content…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button data-testid="docs-search-btn" type="submit" className="btn-primary" disabled={loading || q.trim().length < 2}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {results === null && (
          <Card title="Tips">
            <ul className="text-sm text-bone-300 space-y-1">
              <li>· Search uses Google Drive&apos;s full-text index.</li>
              <li>· Share the Drive folder with the service account email before searching.</li>
              <li>· Min 2 characters required.</li>
            </ul>
          </Card>
        )}

        {results && results.error && (
          <Card title="Status">
            <div className="text-yellow-400 text-sm">{results.error}</div>
            {!results.configured && (
              <div className="text-xs text-bone-300 mt-2">
                Set <code className="text-gold-500">GOOGLE_SERVICE_ACCOUNT_JSON</code> in <code className="text-gold-500">backend/.env</code> and share folder
                <code className="text-gold-500"> {process.env.REACT_APP_DRIVE_FOLDER || "GOOGLE_DRIVE_FOLDER_ID"}</code> with the service account.
              </div>
            )}
          </Card>
        )}

        {results && results.files && (
          <Card title={`Results · ${results.files.length}`} testId="docs-results">
            {results.files.length === 0 ? <Empty message="No matching files." /> : (
              <ul className="divide-y divide-ink-600" data-testid="docs-results-list">
                {results.files.map((f) => (
                  <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {f.mimeType?.includes("folder") ? <Folder size={16} className="text-gold-500" /> : <FileText size={16} className="text-bone-300" />}
                      <div className="min-w-0">
                        <div className="text-bone-100 truncate">{f.name}</div>
                        <div className="text-[11px] text-ink-500 truncate">
                          {f.mimeType} {f.modifiedTime ? `· ${new Date(f.modifiedTime).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                    </div>
                    {f.webViewLink && (
                      <a
                        data-testid={`doc-open-${f.id}`}
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-500 hover:text-crimson-500 shrink-0"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
