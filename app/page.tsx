'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Submission, Rep } from '@/lib/supabase';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/system-prompt';

// ============================================
// STYLES
// ============================================

const styles = {
  colors: {
    bg: '#0a0f1a',
    bgCard: '#111827',
    bgHover: '#1f2937',
    accent: '#22c55e',
    accentDim: '#166534',
    danger: '#ef4444',
    warning: '#f59e0b',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    border: '#374151',
  }
};

// ============================================
// COMPONENTS
// ============================================

const GradeBadge = ({ grade }: { grade: string | null }) => {
  const getGradeColor = (g: string | null) => {
    if (!g) return { bg: '#374151', text: '#9ca3af' };
    const letter = g.charAt(0).toUpperCase();
    if (letter === 'A') return { bg: '#166534', text: '#22c55e' };
    if (letter === 'B') return { bg: '#854d0e', text: '#facc15' };
    if (letter === 'C') return { bg: '#9a3412', text: '#fb923c' };
    if (letter === 'D' || letter === 'F') return { bg: '#991b1b', text: '#fca5a5' };
    return { bg: '#374151', text: '#9ca3af' };
  };
  const colors = getGradeColor(grade);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '4px 12px', borderRadius: '6px', backgroundColor: colors.bg,
      color: colors.text, fontWeight: '700', fontSize: '14px',
      fontFamily: "'Space Mono', monospace", letterSpacing: '0.5px',
    }}>
      {grade || '—'}
    </span>
  );
};

const Spinner = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px' }}>
    <div style={{
      width: '48px', height: '48px', border: `3px solid ${styles.colors.border}`,
      borderTopColor: styles.colors.accent, borderRadius: '50%', animation: 'spin 1s linear infinite',
    }} />
    <p style={{ color: styles.colors.textMuted, fontSize: '14px' }}>Analyzing transcript...</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const MarkdownRenderer = ({ content }: { content: string }) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let listItems: string[] = [];
    let inList = false;
    
    const processInlineStyles = (line: string) => {
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f9fafb;">$1</strong>');
      line = line.replace(/__(.+?)__/g, '<strong style="color:#f9fafb;">$1</strong>');
      line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
      line = line.replace(/`([^`]+)`/g, '<code style="background:#1f2937;padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>');
      return line;
    };
    
    const parseFormField = (line: string): { question: string; answer: string } | null => {
      const match = line.match(/^([^:]+\??)\s*:\s*(.+)$/);
      if (match && match[2].trim().length > 0) {
        return { question: match[1].replace(/\*\*/g, '').trim(), answer: match[2].replace(/\*\*/g, '').trim() };
      }
      return null;
    };
    
    let inFormSection = false;
    const seenQuestions = new Set<string>();
    
    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ margin: '12px 0', paddingLeft: '24px' }}>
            {listItems.map((item, i) => {
              const formMatch = parseFormField(item);
              if (formMatch) {
                return (
                  <li key={i} style={{ marginBottom: '10px', color: '#f9fafb', listStyle: 'none', marginLeft: '-24px' }}>
                    <span style={{ color: '#9ca3af', fontWeight: '600', fontSize: '13px' }}>{formMatch.question}:</span>
                    <span style={{ color: '#22c55e', fontWeight: '500', marginLeft: '8px', fontSize: '15px' }}>{formMatch.answer}</span>
                  </li>
                );
              }
              return <li key={i} style={{ marginBottom: '8px', color: '#f9fafb' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(item) }} />;
            })}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };
    
    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(2);
        elements.push(
          <div key={`table-${elements.length}`} style={{ overflowX: 'auto', margin: '16px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  {headerRow.split('|').filter(c => c.trim()).map((cell, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #374151', color: '#9ca3af', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {cell.trim().replace(/\*\*/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, i) => (
                  <tr key={i}>
                    {row.split('|').filter(c => c.trim()).map((cell, j) => (
                      <td key={j} style={{ padding: '10px 12px', borderBottom: '1px solid #374151', color: '#f9fafb' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(cell.trim()) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(<pre key={`code-${elements.length}`} style={{ backgroundColor: '#0a0f1a', padding: '16px', borderRadius: '8px', overflow: 'auto', margin: '16px 0', fontSize: '13px', lineHeight: '1.5', color: '#f9fafb' }}>{codeContent.join('\n')}</pre>);
          codeContent = [];
          inCodeBlock = false;
        } else {
          flushList(); flushTable(); inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) { codeContent.push(line); continue; }
      if (line.includes('|') && line.trim().startsWith('|')) { flushList(); if (!inTable) inTable = true; tableRows.push(line); continue; } else if (inTable) { flushTable(); }
      if (line.startsWith('### ')) {
        flushList();
        if (line.includes('FORM OUTPUT') || line.includes('Form Output') || line.includes('POST-CALL FORM') || line.includes('Post-Call Form')) inFormSection = true;
        else inFormSection = false;
        elements.push(<h3 key={`h3-${elements.length}`} style={{ color: '#22c55e', fontSize: '16px', fontWeight: '700', margin: '28px 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>{line.replace('### ', '').replace(/\*\*/g, '')}</h3>);
        continue;
      }
      if (line.startsWith('## ')) { flushList(); inFormSection = false; elements.push(<h2 key={`h2-${elements.length}`} style={{ color: '#f9fafb', fontSize: '20px', fontWeight: '800', margin: '28px 0 16px 0' }}>{line.replace('## ', '').replace(/\*\*/g, '')}</h2>); continue; }
      if (line.startsWith('# ')) { flushList(); inFormSection = false; elements.push(<h1 key={`h1-${elements.length}`} style={{ color: '#f9fafb', fontSize: '24px', fontWeight: '800', margin: '32px 0 16px 0' }}>{line.replace('# ', '').replace(/\*\*/g, '')}</h1>); continue; }
      if (line.startsWith('> ')) { flushList(); elements.push(<blockquote key={`quote-${elements.length}`} style={{ borderLeft: '3px solid #22c55e', paddingLeft: '16px', margin: '12px 0', color: '#d1d5db', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(line.replace('> ', '')) }} />); continue; }
      if (line.match(/^[-*] /)) { inList = true; listItems.push(line.replace(/^[-*] /, '')); continue; } else if (inList && line.trim() === '') { flushList(); continue; } else if (inList) { flushList(); }
      if (line.match(/^---+$/)) { inFormSection = false; elements.push(<hr key={`hr-${elements.length}`} style={{ border: 'none', borderTop: '1px solid #374151', margin: '24px 0' }} />); continue; }
      if (line.trim() === '') continue;
      if (inFormSection) {
        const colonIndex = line.indexOf(': ');
        if (colonIndex > 0) {
          const question = line.substring(0, colonIndex).replace(/\*\*/g, '').trim();
          const answer = line.substring(colonIndex + 2).replace(/\*\*/g, '').trim();
          if (seenQuestions.has(question.toLowerCase())) continue;
          seenQuestions.add(question.toLowerCase());
          if (answer.length > 0) {
            elements.push(<div key={`field-${elements.length}`} style={{ marginBottom: '12px' }}><span style={{ color: '#b45309', fontWeight: '600', fontSize: '14px' }}>{question}</span><span style={{ color: '#f9fafb', fontSize: '14px', marginLeft: '8px', fontWeight: '400' }}>{answer}</span></div>);
          }
          continue;
        }
        continue;
      }
      elements.push(<p key={`p-${elements.length}`} style={{ margin: '12px 0', lineHeight: '1.7', color: '#f9fafb', fontSize: '15px' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(line) }} />);
    }
    flushList(); flushTable();
    return elements;
  };
  return <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>{renderMarkdown(content)}</div>;
};

// ============================================
// TYPES
// ============================================

interface LocalSubmission {
  id: string;
  repName: string;
  repCode: string;
  athleteName: string;
  grade: string | null;
  output: string;
  transcript: string;
  timestamp: string;
  interviewDate: string | null;
  flagged: boolean;
  transcriptHeader: string | null;
}

interface TrendsReport {
  patterns: Array<{ issue: string; count: number; percentage: number; description: string; examples: string[]; }>;
  recommendation: string;
  totalCalls: number;
}

// ============================================
// MAIN APP
// ============================================

export default function NextPlayCoachingApp() {
  const [view, setView] = useState<'rep' | 'mySubmissions' | 'admin'>('rep');
  const [adminTab, setAdminTab] = useState<'submissions' | 'reps' | 'instructions' | 'objections' | 'trends'>('submissions');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingOutput, setStreamingOutput] = useState('');
  const [result, setResult] = useState<LocalSubmission | { error: string } | null>(null);
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<LocalSubmission | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterRep, setFilterRep] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [promptSaved, setPromptSaved] = useState(false);
  const [coachingRefDoc, setCoachingRefDoc] = useState('');
  const [coachingRefSaved, setCoachingRefSaved] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsReport, setTrendsReport] = useState<TrendsReport | null>(null);
  const [trendsRep, setTrendsRep] = useState('all');
  const [trendsDateRange, setTrendsDateRange] = useState('30');
  const [showTranscript, setShowTranscript] = useState(false);
  const [repCode, setRepCode] = useState('');
  const [callType, setCallType] = useState('Game Plan');
  const [parentName, setParentName] = useState('');
  const [reps, setReps] = useState<Record<string, Rep>>({});
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRepName, setNewRepName] = useState('');
  const [newRepCode, setNewRepCode] = useState('');
  const [editingRep, setEditingRep] = useState<string | null>(null);
  const [viewRepCode, setViewRepCode] = useState('');
  const [isViewLoggedIn, setIsViewLoggedIn] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [adminPw, setAdminPw] = useState('');
  
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'nextplay';

  useEffect(() => { loadSubmissions(); loadSettings(); loadReps(); }, []);
  
  const normalizeRepName = (name: string) => name ? name.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

  const dbToLocal = (db: Submission): LocalSubmission => ({
    id: db.id, repName: db.rep_name, repCode: '', athleteName: db.athlete_name,
    grade: db.grade, output: db.output, transcript: db.transcript, timestamp: db.created_at,
    interviewDate: db.interview_date, flagged: db.flagged, transcriptHeader: db.transcript_header,
  });
  
  const loadSubmissions = async () => {
    const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false });
    if (data && !error) setSubmissions(data.map(dbToLocal));
  };
  
  const loadReps = async () => {
    const { data, error } = await supabase.from('reps').select('*').order('created_at', { ascending: true });
    if (data && !error) {
      const repsMap: Record<string, Rep> = {};
      data.forEach((rep: Rep) => { repsMap[rep.rep_code] = rep; });
      setReps(repsMap);
    }
  };
  
  const loadSettings = async () => {
    const { data: promptData } = await supabase.from('settings').select('value').eq('key', 'system_prompt').single();
    if (promptData?.value) setSystemPrompt(promptData.value);
    const { data: coachingRefData } = await supabase.from('settings').select('value').eq('key', 'coaching_reference').single();
    if (coachingRefData?.value) setCoachingRefDoc(coachingRefData.value);
  };
  
  const saveSystemPrompt = async (prompt: string) => {
    setSystemPrompt(prompt);
    await supabase.from('settings').upsert({ key: 'system_prompt', value: prompt, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setPromptSaved(true); setTimeout(() => setPromptSaved(false), 2000);
  };
  
  const resetSystemPrompt = async () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    await supabase.from('settings').upsert({ key: 'system_prompt', value: DEFAULT_SYSTEM_PROMPT, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setPromptSaved(true); setTimeout(() => setPromptSaved(false), 2000);
  };
  
  const saveCoachingRefDoc = async (doc: string) => {
    setCoachingRefDoc(doc);
    await supabase.from('settings').upsert({ key: 'coaching_reference', value: doc, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setCoachingRefSaved(true); setTimeout(() => setCoachingRefSaved(false), 2000);
  };
  
  const validateRepCode = (code: string): Rep | null => {
    const normalized = code.trim().toLowerCase();
    return reps[normalized] && reps[normalized].active ? reps[normalized] : null;
  };
  
  const extractTranscriptHeader = (transcript: string): string => transcript.split('\n')[0].trim();
  
  const checkDuplicate = async (header: string): Promise<boolean> => {
    const { data } = await supabase.from('submissions').select('id').eq('transcript_header', header).limit(1);
    return !!(data && data.length > 0);
  };
  
  const saveSubmission = async (submission: LocalSubmission) => {
    const rep = validateRepCode(submission.repCode);
    const { data, error } = await supabase.from('submissions').insert({
      rep_name: submission.repName, athlete_name: submission.athleteName, grade: submission.grade,
      output: submission.output, transcript: submission.transcript, interview_date: submission.interviewDate,
      flagged: submission.flagged, transcript_header: submission.transcriptHeader, rep_id: rep?.id || null,
    }).select().single();
    if (!error && data) {
      const savedSubmission = { ...submission, id: data.id };
      setSubmissions(prev => [savedSubmission, ...prev]);
      return savedSubmission;
    }
    return null;
  };
  
  const deleteSubmission = async (id: string) => {
    await supabase.from('submissions').delete().eq('id', id);
    setSubmissions(prev => prev.filter(s => s.id !== id));
    setSelectedSubmission(null);
  };
  
  const toggleSelectSubmission = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  
  const toggleSelectAll = () => {
    const filteredIds = filteredSubmissions.map(s => s.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    else setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };
  
  const deleteSelectedSubmissions = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) await supabase.from('submissions').delete().eq('id', id);
    setSubmissions(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  };
  
  const downloadSelectedSubmissions = () => {
    if (selectedIds.length === 0) return;
    const selected = submissions.filter(s => selectedIds.includes(s.id));
    let content = `# Next Play Coaching Analysis Export\n# ${selected.length} submissions exported on ${new Date().toLocaleDateString()}\n\n---\n\n`;
    selected.forEach((sub, index) => {
      content += `## Submission ${index + 1}: ${sub.athleteName}\n**Rep:** ${sub.repName}\n**Grade:** ${sub.grade || 'N/A'}\n`;
      content += `**Interview Date:** ${sub.interviewDate ? new Date(sub.interviewDate).toLocaleDateString() : 'N/A'}\n`;
      content += `**Submitted:** ${new Date(sub.timestamp).toLocaleDateString()}\n\n### Coaching Output\n\n${sub.output}\n\n---\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `nextplay-analysis-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  
  const generateTrendsReport = async () => {
    let filtered = [...submissions];
    if (trendsRep !== 'all') filtered = filtered.filter(s => normalizeRepName(s.repName) === trendsRep);
    if (trendsDateRange !== 'all') {
      const days = parseInt(trendsDateRange);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      filtered = filtered.filter(s => new Date(s.interviewDate || s.timestamp) > cutoff);
    }
    if (filtered.length < 2) { alert('Need at least 2 submissions to generate a trends report.'); return; }
    const replayMoments = filtered.map(s => {
      const output = s.output || '';
      const replayMatch = output.match(/### 5\. REPLAY THESE MOMENTS([\s\S]*?)(?=###|$)/i);
      return { repName: s.repName, athleteName: s.athleteName, grade: s.grade, date: s.timestamp, moments: replayMatch ? replayMatch[1].trim() : '' };
    }).filter(r => r.moments.length > 0);
    if (replayMoments.length < 2) { alert('Not enough "Replay These Moments" data to analyze.'); return; }
    setTrendsLoading(true); setTrendsReport(null);
    try {
      const response = await fetch('/api/trends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replayMoments }) });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTrendsReport(data);
    } catch (error) { console.error('Error generating trends:', error); alert('Failed to generate trends report. Please try again.'); }
    setTrendsLoading(false);
  };
  
  const extractGrade = (text: string) => {
    const gradeMatch = text.match(/\*\*Grade:\s*([A-F][+\-]*)\*\*/i) || text.match(/Grade:\s*([A-F][+\-]*)/i);
    return gradeMatch ? gradeMatch[1] : null;
  };

  // Convert a letter grade to a numeric point value (4.3 scale)
  const gradeToPoints = (g: string): number | null => {
    const map: Record<string, number> = {
      'A+': 4.3, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0,
    };
    const key = g.trim().toUpperCase();
    return key in map ? map[key] : null;
  };

  // Convert a numeric point value back to the nearest letter grade
  const pointsToGrade = (p: number): string => {
    const scale: Array<[number, string]> = [
      [4.15, 'A+'], [3.85, 'A'], [3.5, 'A-'],
      [3.15, 'B+'], [2.85, 'B'], [2.5, 'B-'],
      [2.15, 'C+'], [1.85, 'C'], [1.5, 'C-'],
      [1.15, 'D+'], [0.85, 'D'], [0.35, 'D-'],
      [-1, 'F'],
    ];
    for (const [threshold, letter] of scale) {
      if (p >= threshold) return letter;
    }
    return 'F';
  };

  // Compute the overall grade as the average of the dimension-scorecard grades.
  // Reads grades out of the markdown table rows in section 7. Falls back to the
  // model's stated overall grade if it can't find enough dimension grades.
  const computeOverallGrade = (text: string): string | null => {
    // Isolate the dimension scorecard section so we don't pick up the overall grade line
    const sectionMatch = text.match(/DIMENSION SCORECARD([\s\S]*?)(?:\n#{1,3}\s|\n###|ONE THING TO LOCK|$)/i);
    const section = sectionMatch ? sectionMatch[1] : text;
    // Pull the grade out of each table row: | Dimension | Grade | Note |
    const rowRegex = /\|[^\n|]+\|\s*([A-F][+\-]?)\s*\|/g;
    const points: number[] = [];
    let m;
    while ((m = rowRegex.exec(section)) !== null) {
      const pts = gradeToPoints(m[1]);
      if (pts !== null) points.push(pts);
    }
    if (points.length < 3) return null; // not enough dimensions found — fall back
    const avg = points.reduce((a, b) => a + b, 0) / points.length;
    return pointsToGrade(avg);
  };
  
  const extractAthleteName = (text: string) => {
    // Prefer the full parent name (first + last) from the form output
    const firstMatch = text.match(/Parent First Name:\s*([^\n]+)/i);
    const lastMatch = text.match(/Parent Last Name:\s*([^\n]+)/i);
    const clean = (s: string | undefined) => {
      if (!s) return '';
      const v = s.trim();
      // ignore blanks/placeholders the model might leave
      if (!v || /^(n\/?a|none|not (covered|provided|stated|mentioned)|unknown|\[.*\])$/i.test(v)) return '';
      return v;
    };
    const first = clean(firstMatch?.[1]);
    const last = clean(lastMatch?.[1]);
    const full = [first, last].filter(Boolean).join(' ');
    if (full) return full;
    // Fallbacks: any single-name field, then the header
    const nameMatch = text.match(/Athlete's Name:\s*([^\n]+)/i)
      || text.match(/ATHLETE:\s*([^,\n]+)/i)
      || text.match(/Eval Call\s*[–-]\s*([A-Za-z]+)/i)
      || text.match(/Athlete Interview\s*[–-]\s*([A-Za-z]+)/i);
    return nameMatch ? nameMatch[1].trim() : 'Unknown';
  };
  
  const extractInterviewDate = (transcript: string) => {
    const patterns = [/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}(?:\s+[A-Z]{2,4})?)/i, /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i, /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i, /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/i];
    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        try {
          const dateStr = match[1].replace(/\//g, '-').replace(/\s+[A-Z]{2,4}$/i, '');
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) return parsed.toISOString();
        } catch { /* continue */ }
        return match[1];
      }
    }
    return null;
  };
  
  const handleSubmit = async () => {
    setSubmitError('');
    const transcriptInput = document.getElementById('transcript-input') as HTMLTextAreaElement;
    const transcriptText = transcriptInput?.value?.trim();
    const normalizedCode = repCode.trim().toLowerCase();
    const rep = validateRepCode(normalizedCode);
    if (!rep) { setSubmitError('Rep code not recognized. Contact your admin.'); return; }
    if (!transcriptText) { setSubmitError('Please paste a transcript.'); return; }
    const header = extractTranscriptHeader(transcriptText);
    const isDuplicate = await checkDuplicate(header);
    if (isDuplicate) { setSubmitError('This transcript has already been submitted.'); return; }
    setIsLoading(true); setResult(null); setStreamingOutput('');
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: transcriptText, repName: rep.rep_name, callType }) });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      const decoder = new TextDecoder();
      let fullOutput = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) { fullOutput = parsed.fullText || fullOutput + parsed.text; setStreamingOutput(fullOutput); }
              if (parsed.done) fullOutput = parsed.fullText;
            } catch { /* skip */ }
          }
        }
      }
      const grade = computeOverallGrade(fullOutput) || extractGrade(fullOutput);
      const typedParent = parentName.trim();
      const athleteName = typedParent || extractAthleteName(fullOutput);
      const interviewDate = extractInterviewDate(transcriptText);
      const submission: LocalSubmission = {
        id: Date.now().toString(), repName: rep.rep_name, repCode: normalizedCode, athleteName, grade,
        output: fullOutput, transcript: transcriptText, timestamp: new Date().toISOString(), interviewDate,
        flagged: ['B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].includes(grade || ''), transcriptHeader: header,
      };
      const saved = await saveSubmission(submission);
      setResult(saved || submission);
      setStreamingOutput('');
    } catch (error) { console.error('Error:', error); setResult({ error: 'Failed to analyze transcript. Please try again.' }); }
    setIsLoading(false);
  };
  
  const handleAddRep = async () => {
    if (!newRepName.trim() || !newRepCode.trim()) return;
    const code = newRepCode.trim().toLowerCase();
    if (reps[code]) { alert('This code already exists.'); return; }
    const { data, error } = await supabase.from('reps').insert({ rep_name: newRepName.trim(), rep_code: code, active: true }).select().single();
    if (!error && data) { setReps(prev => ({ ...prev, [code]: data })); setNewRepName(''); setNewRepCode(''); setShowAddRep(false); }
    else alert('Failed to add rep. Code may already exist.');
  };
  
  const handleUpdateRep = async (oldCode: string, newName: string, newCode: string) => {
    const rep = reps[oldCode];
    if (!rep) return;
    const normalizedNewCode = newCode.trim().toLowerCase();
    const { error } = await supabase.from('reps').update({ rep_name: newName.trim(), rep_code: normalizedNewCode }).eq('id', rep.id);
    if (!error) {
      const updatedReps = { ...reps }; delete updatedReps[oldCode];
      updatedReps[normalizedNewCode] = { ...rep, rep_name: newName.trim(), rep_code: normalizedNewCode };
      setReps(updatedReps); setEditingRep(null); loadSubmissions();
    } else alert('Failed to update rep.');
  };
  
  const handleToggleRepActive = async (code: string) => {
    const rep = reps[code];
    if (!rep) return;
    const { error } = await supabase.from('reps').update({ active: !rep.active }).eq('id', rep.id);
    if (!error) setReps(prev => ({ ...prev, [code]: { ...prev[code], active: !prev[code].active } }));
  };
  
  const filteredSubmissions = submissions.filter(sub => {
    if (filterRep !== 'all' && normalizeRepName(sub.repName) !== filterRep) return false;
    if (filterGrade !== 'all' && sub.grade?.charAt(0) !== filterGrade) return false;
    const subDate = new Date(sub.interviewDate || sub.timestamp);
    const now = new Date();
    if (filterDateRange !== 'all' && filterDateRange !== 'custom') {
      if (filterDateRange === 'today') { const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (subDate < today) return false; }
      else if (filterDateRange === 'week') { const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); if (subDate < weekAgo) return false; }
      else if (filterDateRange === 'month') { const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); if (subDate < monthAgo) return false; }
    } else if (filterDateRange === 'custom') {
      if (filterDateStart) { const startDate = new Date(filterDateStart); if (subDate < startDate) return false; }
      if (filterDateEnd) { const endDate = new Date(filterDateEnd); endDate.setHours(23, 59, 59, 999); if (subDate > endDate) return false; }
    }
    return true;
  });
  
  const mySubmissions = submissions.filter(s => {
    const rep = validateRepCode(viewRepCode);
    return rep && normalizeRepName(s.repName) === normalizeRepName(rep.rep_name);
  });
  
  const repNames = Array.from(new Set(submissions.map(s => normalizeRepName(s.repName)))).filter(Boolean);


  // ============================================
  // MAIN RENDER - ALL VIEWS INLINED
  // ============================================
  
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        gap: '8px', padding: '12px', backgroundColor: 'rgba(10, 15, 26, 0.95)',
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${styles.colors.border}`, zIndex: 1000,
      }}>
        <button onClick={() => setView('rep')} style={{
          padding: '10px 20px', backgroundColor: view === 'rep' ? styles.colors.accent : 'transparent',
          color: view === 'rep' ? '#000' : styles.colors.text,
          border: view === 'rep' ? 'none' : `1px solid ${styles.colors.border}`,
          borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
        }}>Submit Transcript</button>
        <button onClick={() => setView('mySubmissions')} style={{
          padding: '10px 20px', backgroundColor: view === 'mySubmissions' ? styles.colors.accent : 'transparent',
          color: view === 'mySubmissions' ? '#000' : styles.colors.text,
          border: view === 'mySubmissions' ? 'none' : `1px solid ${styles.colors.border}`,
          borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
        }}>View My Submissions</button>
        <button onClick={() => setView('admin')} style={{
          padding: '10px 20px', backgroundColor: view === 'admin' ? styles.colors.accent : 'transparent',
          color: view === 'admin' ? '#000' : styles.colors.text,
          border: view === 'admin' ? 'none' : `1px solid ${styles.colors.border}`,
          borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
        }}>Admin Dashboard</button>
      </nav>
      
      <div style={{ paddingTop: '60px' }}>
        
        {/* ========== REP VIEW (Submit Transcript) ========== */}
        {view === 'rep' && (
          <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, padding: '40px 20px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '32px' }}>🏈</span>
                  <h1 style={{ fontSize: '28px', fontWeight: '800', color: styles.colors.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px', margin: 0 }}>NEXT PLAY</h1>
                </div>
                <p style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>Eval Specialist Command Center</p>
              </div>
              
              {!result ? (
                <>
                  <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '32px', border: `1px solid ${styles.colors.border}` }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
                      <div>
                        <label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Rep Code</label>
                        <input
                          type="text"
                          value={repCode}
                          onChange={(e) => setRepCode(e.target.value)}
                          placeholder="e.g., keegan-001"
                          style={{ width: '200px', padding: '14px 16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '16px', outline: 'none' }}
                        />
                        {repCode.length >= 5 && (
                          <div style={{ marginTop: '8px', fontSize: '14px', color: validateRepCode(repCode) ? styles.colors.accent : styles.colors.danger }}>
                            {validateRepCode(repCode) ? `✓ ${validateRepCode(repCode)!.rep_name}` : '✗ Code not recognized'}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Call Type</label>
                        <select
                          value={callType}
                          onChange={(e) => setCallType(e.target.value)}
                          style={{ width: '200px', padding: '14px 16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '16px', outline: 'none', cursor: 'pointer' }}
                        >
                          <option value="Game Plan">Game Plan</option>
                          <option value="Auto Book">Auto Book</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Parent Name <span style={{ textTransform: 'none', fontWeight: '400' }}>(optional)</span></label>
                        <input
                          type="text"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          placeholder="auto-detected if blank"
                          style={{ width: '220px', padding: '14px 16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '16px', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Paste Transcript</label>
                      <textarea id="transcript-input" placeholder="Paste the call transcript here..."
                        style={{ width: '100%', minHeight: '300px', padding: '16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', fontFamily: "'Space Mono', monospace", lineHeight: '1.6', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <p style={{ fontSize: '12px', color: styles.colors.textMuted, marginTop: '8px' }}>Select the call type above. If you leave Parent Name blank, the name is pulled from the call.</p>
                    </div>
                    <button onClick={handleSubmit} disabled={isLoading}
                      style={{ width: '100%', padding: '16px', backgroundColor: isLoading ? styles.colors.border : styles.colors.accent, color: isLoading ? styles.colors.textMuted : '#000', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                      {isLoading ? 'Analyzing...' : 'Get Coaching Feedback'}
                    </button>
                    {submitError && (
                      <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: `1px solid ${styles.colors.danger}`, borderRadius: '8px', color: styles.colors.danger, fontSize: '14px' }}>{submitError}</div>
                    )}
                  </div>
                  {isLoading && (
                    <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', marginTop: '24px', padding: '32px', border: `1px solid ${styles.colors.border}` }}>
                      {streamingOutput ? <MarkdownRenderer content={streamingOutput} /> : <Spinner />}
                    </div>
                  )}
                </>
              ) : 'error' in result ? (
                <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '32px', border: `1px solid ${styles.colors.danger}`, textAlign: 'center' }}>
                  <p style={{ color: styles.colors.danger, fontSize: '16px', marginBottom: '16px' }}>{result.error}</p>
                  <button onClick={() => setResult(null)} style={{ padding: '12px 24px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Try Again</button>
                </div>
              ) : (
                <div>
                  <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: `1px solid ${styles.colors.accent}`, borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><span style={{ color: styles.colors.accent, fontWeight: '700' }}>✓ Submission #{result.id.slice(-6)} saved</span><span style={{ color: styles.colors.textMuted, marginLeft: '12px' }}>{result.athleteName}</span></div>
                    <GradeBadge grade={result.grade} />
                  </div>
                  <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}`, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: `1px solid ${styles.colors.border}` }}>
                      <button onClick={() => setShowTranscript(false)} style={{ flex: 1, padding: '14px', backgroundColor: !showTranscript ? styles.colors.bgHover : 'transparent', border: 'none', color: !showTranscript ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer' }}>Results</button>
                      <button onClick={() => setShowTranscript(true)} style={{ flex: 1, padding: '14px', backgroundColor: showTranscript ? styles.colors.bgHover : 'transparent', border: 'none', color: showTranscript ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer' }}>Transcript</button>
                    </div>
                    <div style={{ padding: '24px' }}>
                      {showTranscript ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: "'Space Mono', monospace", fontSize: '13px', lineHeight: '1.6', color: styles.colors.textMuted, margin: 0 }}>{result.transcript}</pre> : <MarkdownRenderer content={result.output} />}
                    </div>
                  </div>
                  <button onClick={() => { setResult(null); setRepCode(''); setParentName(''); setShowTranscript(false); const input = document.getElementById('transcript-input') as HTMLTextAreaElement; if (input) input.value = ''; }}
                    style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                    ← Submit Another Transcript
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ========== MY SUBMISSIONS VIEW ========== */}
        {view === 'mySubmissions' && (
          <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, padding: '40px 20px' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <h1 style={{ color: styles.colors.text, fontSize: '28px', fontWeight: '800', marginBottom: '24px' }}>📋 View My Submissions</h1>
              {!isViewLoggedIn ? (
                <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '32px', border: `1px solid ${styles.colors.border}`, maxWidth: '400px' }}>
                  <label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Enter Your Rep Code</label>
                  <input type="text" value={viewRepCode} onChange={(e) => setViewRepCode(e.target.value)} placeholder="e.g., keegan-001"
                    style={{ width: '100%', padding: '14px 16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '16px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
                  <button onClick={() => { if (validateRepCode(viewRepCode)) setIsViewLoggedIn(true); else alert('Rep code not recognized.'); }}
                    style={{ width: '100%', padding: '14px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>View Submissions</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <span style={{ color: styles.colors.textMuted }}>{validateRepCode(viewRepCode)?.rep_name} · {mySubmissions.length} submissions</span>
                    <button onClick={() => { setIsViewLoggedIn(false); setViewRepCode(''); setSelectedSubmission(null); }}
                      style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, cursor: 'pointer' }}>Log Out</button>
                  </div>
                  {selectedSubmission ? (
                    <div>
                      <button onClick={() => setSelectedSubmission(null)} style={{ marginBottom: '16px', padding: '8px 16px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, cursor: 'pointer' }}>← Back to List</button>
                      <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}`, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div><h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: 0 }}>{selectedSubmission.athleteName}</h2><p style={{ color: styles.colors.textMuted, fontSize: '14px', margin: '4px 0 0' }}>{selectedSubmission.interviewDate ? new Date(selectedSubmission.interviewDate).toLocaleDateString() : new Date(selectedSubmission.timestamp).toLocaleDateString()}</p></div>
                          <GradeBadge grade={selectedSubmission.grade} />
                        </div>
                        <div style={{ display: 'flex', borderBottom: `1px solid ${styles.colors.border}` }}>
                          <button onClick={() => setShowTranscript(false)} style={{ flex: 1, padding: '12px', backgroundColor: !showTranscript ? styles.colors.bgHover : 'transparent', border: 'none', color: !showTranscript ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer' }}>Results</button>
                          <button onClick={() => setShowTranscript(true)} style={{ flex: 1, padding: '12px', backgroundColor: showTranscript ? styles.colors.bgHover : 'transparent', border: 'none', color: showTranscript ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer' }}>Transcript</button>
                        </div>
                        <div style={{ padding: '24px', maxHeight: '500px', overflow: 'auto' }}>
                          {showTranscript ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: "'Space Mono', monospace", fontSize: '13px', lineHeight: '1.6', color: styles.colors.textMuted, margin: 0 }}>{selectedSubmission.transcript}</pre> : <MarkdownRenderer content={selectedSubmission.output} />}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}`, overflow: 'hidden' }}>
                      {mySubmissions.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No submissions yet</div>
                      ) : mySubmissions.map(sub => (
                        <div key={sub.id} onClick={() => { setSelectedSubmission(sub); setShowTranscript(false); }}
                          style={{ padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div><p style={{ color: styles.colors.text, fontWeight: '600', margin: '0 0 4px' }}>{sub.athleteName}</p><p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>{sub.interviewDate ? new Date(sub.interviewDate).toLocaleDateString() : new Date(sub.timestamp).toLocaleDateString()}</p></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><GradeBadge grade={sub.grade} /><span style={{ color: styles.colors.textMuted }}>→</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ========== ADMIN VIEW ========== */}
        {view === 'admin' && (
          !isAuthenticated ? (
            <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '40px', border: `1px solid ${styles.colors.border}`, maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔒</span>
                <h2 style={{ color: styles.colors.text, fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Admin Access</h2>
                <p style={{ color: styles.colors.textMuted, fontSize: '14px', marginBottom: '24px' }}>Enter password to view submissions</p>
                <input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="Password"
                  onKeyDown={(e) => { if (e.key === 'Enter' && adminPw === ADMIN_PASSWORD) setIsAuthenticated(true); }}
                  style={{ width: '100%', padding: '14px 16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '16px', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={() => { if (adminPw === ADMIN_PASSWORD) setIsAuthenticated(true); }}
                  style={{ width: '100%', padding: '14px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>Enter</button>
              </div>
            </div>
          ) : (
            <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, padding: '40px 20px' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div><h1 style={{ color: styles.colors.text, fontSize: '28px', fontWeight: '800', margin: '0 0 4px 0' }}>📊 Admin Dashboard</h1><p style={{ color: styles.colors.textMuted, fontSize: '14px', margin: 0 }}>{submissions.length} total submissions</p></div>
                </div>
                
                {/* Admin Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${styles.colors.border}`, paddingBottom: '16px', flexWrap: 'wrap' }}>
                  {(['submissions', 'reps', 'instructions', 'objections', 'trends'] as const).map(tab => (
                    <button key={tab} onClick={() => setAdminTab(tab)}
                      style={{ padding: '10px 20px', backgroundColor: adminTab === tab ? styles.colors.bgHover : 'transparent', color: adminTab === tab ? styles.colors.text : styles.colors.textMuted, border: `1px solid ${adminTab === tab ? styles.colors.border : 'transparent'}`, borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                      {tab === 'submissions' && '📋 Submissions'}{tab === 'reps' && '👥 Manage Reps'}{tab === 'instructions' && '⚙️ Edit Instructions'}{tab === 'objections' && '📚 Coaching Reference Library'}{tab === 'trends' && '📈 Trends Report'}
                    </button>
                  ))}
                </div>
                
                {/* MANAGE REPS TAB */}
                {adminTab === 'reps' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: 0 }}>Rep Codes</h2>
                      <button onClick={() => setShowAddRep(true)} style={{ padding: '10px 16px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Add Rep</button>
                    </div>
                    {showAddRep && (
                      <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '20px', border: `1px solid ${styles.colors.border}`, marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div><label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', marginBottom: '6px' }}>Rep Name</label><input type="text" value={newRepName} onChange={(e) => setNewRepName(e.target.value)} placeholder="Keegan Jones" style={{ padding: '10px 14px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '180px' }} /></div>
                          <div><label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', marginBottom: '6px' }}>Code</label><input type="text" value={newRepCode} onChange={(e) => setNewRepCode(e.target.value)} placeholder="keegan-001" style={{ padding: '10px 14px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '140px', fontFamily: 'monospace' }} /></div>
                          <button onClick={handleAddRep} style={{ padding: '10px 16px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => { setShowAddRep(false); setNewRepName(''); setNewRepCode(''); }} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}`, overflow: 'hidden' }}>
                      {Object.keys(reps).length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No reps yet. Add your first rep above.</div>
                      ) : Object.entries(reps).map(([code, rep]) => (
                        <div key={code} style={{ padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: rep.active ? 1 : 0.5 }}>
                          {editingRep === code ? (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                              <input type="text" defaultValue={rep.rep_name} id={`edit-name-${code}`} style={{ padding: '8px 12px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '160px' }} />
                              <input type="text" defaultValue={code} id={`edit-code-${code}`} style={{ padding: '8px 12px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '120px', fontFamily: 'monospace' }} />
                              <button onClick={() => { const newName = (document.getElementById(`edit-name-${code}`) as HTMLInputElement).value; const newCode = (document.getElementById(`edit-code-${code}`) as HTMLInputElement).value; handleUpdateRep(code, newName, newCode); }} style={{ padding: '8px 12px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                              <button onClick={() => setEditingRep(null)} style={{ padding: '8px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <div><p style={{ color: styles.colors.text, fontWeight: '600', margin: '0 0 2px' }}>{rep.rep_name}{!rep.active && <span style={{ color: styles.colors.danger, fontSize: '12px', marginLeft: '8px' }}>(Inactive)</span>}</p><p style={{ color: styles.colors.textMuted, fontSize: '13px', fontFamily: 'monospace', margin: 0 }}>{code}</p></div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setEditingRep(code)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}>Edit</button>
                                <button onClick={() => handleToggleRepActive(code)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: rep.active ? styles.colors.danger : styles.colors.accent, fontSize: '13px', cursor: 'pointer' }}>{rep.active ? 'Deactivate' : 'Activate'}</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* EDIT INSTRUCTIONS TAB */}
                {adminTab === 'instructions' && (
                  <div>
                    <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '24px', border: `1px solid ${styles.colors.border}`, marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div><h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>System Instructions</h2><p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>Customize how Claude analyzes transcripts and grades calls.</p></div>
                        {promptSaved && <span style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '600' }}>✓ Saved</span>}
                      </div>
                      <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                        style={{ width: '100%', minHeight: '500px', padding: '16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '13px', fontFamily: "'Space Mono', monospace", lineHeight: '1.6', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => saveSystemPrompt(systemPrompt)} style={{ padding: '12px 24px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Save Changes</button>
                      <button onClick={resetSystemPrompt} style={{ padding: '12px 24px', backgroundColor: 'transparent', color: styles.colors.textMuted, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Reset to Default</button>
                    </div>
                  </div>
                )}
                
                {/* OBJECTION HANDLING TAB */}
                {adminTab === 'objections' && (
                  <div>
                    <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '24px', border: `1px solid ${styles.colors.border}`, marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div><h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>Coaching Reference Library</h2><p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>Reference examples the grader uses during analysis. Use two sections: OBJECTION HANDLES (how to handle pushback) and MUST-PULL DISCOVERY THREADS (parent opens X, rep should dig into Y).</p></div>
                        {coachingRefSaved && <span style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '600' }}>✓ Saved</span>}
                      </div>
                      <textarea value={coachingRefDoc} onChange={(e) => setCoachingRefDoc(e.target.value)}
                        placeholder="## OBJECTION HANDLES&#10;[parent pushes back with X -> the move]&#10;&#10;## MUST-PULL DISCOVERY THREADS&#10;[parent opens X -> rep should dig into Y; flag if skipped]"
                        style={{ width: '100%', minHeight: '400px', padding: '16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '13px', fontFamily: "'Space Mono', monospace", lineHeight: '1.6', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={() => saveCoachingRefDoc(coachingRefDoc)} style={{ padding: '12px 24px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Save Coaching Reference Library</button>
                  </div>
                )}
                
                {/* TRENDS REPORT TAB */}
                {adminTab === 'trends' && (
                  <div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select value={trendsRep} onChange={(e) => setTrendsRep(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', cursor: 'pointer' }}>
                        <option value="all">All Reps</option>
                        {repNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                      <select value={trendsDateRange} onChange={(e) => setTrendsDateRange(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', cursor: 'pointer' }}>
                        <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option>
                      </select>
                      <button onClick={generateTrendsReport} disabled={trendsLoading} style={{ padding: '10px 20px', backgroundColor: trendsLoading ? styles.colors.border : styles.colors.accent, color: trendsLoading ? styles.colors.textMuted : '#000', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: trendsLoading ? 'not-allowed' : 'pointer' }}>{trendsLoading ? 'Analyzing...' : 'Generate Trends Report'}</button>
                    </div>
                    {trendsReport && (
                      <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', padding: '24px', border: `1px solid ${styles.colors.border}` }}>
                        <h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Pattern Analysis ({trendsReport.totalCalls} calls)</h2>
                        {trendsReport.patterns.map((pattern, i) => (
                          <div key={i} style={{ padding: '16px', backgroundColor: styles.colors.bg, borderRadius: '8px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <h3 style={{ color: styles.colors.text, fontSize: '16px', fontWeight: '600', margin: 0 }}>{pattern.issue}</h3>
                              <span style={{ backgroundColor: styles.colors.warning, color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>{pattern.count} calls ({pattern.percentage}%)</span>
                            </div>
                            <p style={{ color: styles.colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>{pattern.description}</p>
                            {pattern.examples.length > 0 && (
                              <div style={{ borderLeft: `2px solid ${styles.colors.border}`, paddingLeft: '12px' }}>
                                {pattern.examples.map((ex, j) => <p key={j} style={{ color: styles.colors.text, fontSize: '13px', margin: '4px 0', fontStyle: 'italic' }}>"{ex}"</p>)}
                              </div>
                            )}
                          </div>
                        ))}
                        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: styles.colors.accentDim, borderRadius: '8px' }}>
                          <h3 style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '700', margin: '0 0 8px' }}>📌 Training Recommendation</h3>
                          <p style={{ color: styles.colors.text, fontSize: '14px', margin: 0 }}>{trendsReport.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* SUBMISSIONS TAB */}
                {adminTab === 'submissions' && (
                  <>
                    {selectedSubmission ? (
                      <div>
                        <button onClick={() => setSelectedSubmission(null)} style={{ marginBottom: '16px', padding: '8px 16px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, cursor: 'pointer' }}>← Back to List</button>
                        <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}`, overflow: 'hidden' }}>
                          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: 0 }}>{selectedSubmission.athleteName}</h2><p style={{ color: styles.colors.textMuted, fontSize: '14px', margin: '4px 0 0' }}>{selectedSubmission.repName} · {selectedSubmission.interviewDate ? new Date(selectedSubmission.interviewDate).toLocaleDateString() : new Date(selectedSubmission.timestamp).toLocaleDateString()}</p></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <GradeBadge grade={selectedSubmission.grade} />
                              <button onClick={() => { if (confirm('Delete this submission?')) deleteSubmission(selectedSubmission.id); }} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.danger}`, borderRadius: '6px', color: styles.colors.danger, fontSize: '13px', cursor: 'pointer' }}>Delete</button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', borderBottom: `1px solid ${styles.colors.border}` }}>
                            <button onClick={() => setShowTranscript(false)} style={{ flex: 1, padding: '12px', backgroundColor: !showTranscript ? styles.colors.bgHover : 'transparent', border: 'none', color: !showTranscript ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer' }}>Results</button>
                            <button onClick={() => setShowTranscript(true)} style={{ flex: 1, padding: '12px', backgroundColor: showTranscript ? styles.colors.bgHover : 'transparent', border: 'none', color: showTranscript ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer' }}>Transcript</button>
                          </div>
                          <div style={{ padding: '24px', maxHeight: '500px', overflow: 'auto' }}>
                            {showTranscript ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: "'Space Mono', monospace", fontSize: '13px', lineHeight: '1.6', color: styles.colors.textMuted, margin: 0 }}>{selectedSubmission.transcript}</pre> : <MarkdownRenderer content={selectedSubmission.output} />}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Reps</option>
                            {repNames.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Grades</option><option value="A">A Range</option><option value="B">B Range</option><option value="C">C or Below</option>
                          </select>
                          <select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Time</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">Last 30 Days</option><option value="custom">Custom Range</option>
                          </select>
                          {filterDateRange === 'custom' && (
                            <>
                              <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }} />
                              <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }} />
                            </>
                          )}
                        </div>
                        {selectedIds.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: styles.colors.bgCard, borderRadius: '8px', marginBottom: '16px' }}>
                            <span style={{ color: styles.colors.text, fontSize: '14px' }}>{selectedIds.length} selected</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={downloadSelectedSubmissions} style={{ padding: '8px 16px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>📥 Download</button>
                              <button onClick={deleteSelectedSubmissions} style={{ padding: '8px 16px', backgroundColor: styles.colors.danger, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>🗑️ Delete</button>
                            </div>
                          </div>
                        )}
                        <div style={{ backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}`, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px 120px 120px 50px', gap: '12px', padding: '16px 24px', backgroundColor: styles.colors.bg, borderBottom: `1px solid ${styles.colors.border}`, alignItems: 'center' }}>
                            <input type="checkbox" checked={filteredSubmissions.length > 0 && filteredSubmissions.every(s => selectedIds.includes(s.id))} onChange={toggleSelectAll} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: styles.colors.accent }} />
                            <span style={{ color: styles.colors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Athlete</span>
                            <span style={{ color: styles.colors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rep</span>
                            <span style={{ color: styles.colors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grade</span>
                            <span style={{ color: styles.colors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interview</span>
                            <span style={{ color: styles.colors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Submitted</span>
                            <span></span>
                          </div>
                          {filteredSubmissions.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No submissions found</div>
                          ) : filteredSubmissions.map(sub => (
                            <div key={sub.id} onClick={() => { setSelectedSubmission(sub); setShowTranscript(false); }}
                              style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px 120px 120px 50px', gap: '12px', padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, backgroundColor: selectedIds.includes(sub.id) ? 'rgba(34, 197, 94, 0.1)' : sub.flagged ? 'rgba(239, 68, 68, 0.05)' : 'transparent', alignItems: 'center', cursor: 'pointer' }}>
                              <input type="checkbox" checked={selectedIds.includes(sub.id)} onChange={(e) => { e.stopPropagation(); toggleSelectSubmission(sub.id); }} onClick={(e) => e.stopPropagation()} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: styles.colors.accent }} />
                              <span style={{ color: styles.colors.text, fontSize: '14px', fontWeight: '600' }}>{sub.flagged && <span style={{ marginRight: '8px' }}>🚩</span>}{sub.athleteName}</span>
                              <span style={{ color: styles.colors.textMuted, fontSize: '14px' }}>{sub.repName}</span>
                              <GradeBadge grade={sub.grade} />
                              <span style={{ color: styles.colors.text, fontSize: '13px' }}>{new Date(sub.interviewDate || sub.timestamp).toLocaleDateString()}</span>
                              <span style={{ color: styles.colors.textMuted, fontSize: '13px' }}>{new Date(sub.timestamp).toLocaleDateString()}</span>
                              <span style={{ color: styles.colors.textMuted, fontSize: '14px' }}>→</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
