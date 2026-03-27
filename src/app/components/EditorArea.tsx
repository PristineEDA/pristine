import { useState, useRef, useCallback, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import {
  X, ChevronRight, AlertCircle, AlertTriangle, Split,
  MoreHorizontal, Circle,
} from 'lucide-react';
import { fileContents, problemsList } from '../../data/mockData';

interface Tab {
  id: string;
  name: string;
  modified?: boolean;
}

interface EditorAreaProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  editorRef: React.MutableRefObject<any>;
  jumpToLine?: number;
  onCursorChange?: (line: number, col: number) => void;
}

// ─── Verilog language definition ──────────────────────────────────────────────
const verilogKeywords = [
  'module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'logic',
  'always', 'always_ff', 'always_comb', 'always_latch', 'assign', 'begin', 'end',
  'if', 'else', 'case', 'casex', 'casez', 'endcase', 'default', 'for', 'while',
  'repeat', 'forever', 'fork', 'join', 'parameter', 'localparam', 'defparam',
  'posedge', 'negedge', 'or', 'and', 'not', 'nand', 'nor', 'xor', 'xnor',
  'integer', 'real', 'time', 'realtime', 'genvar', 'generate', 'endgenerate',
  'function', 'endfunction', 'task', 'endtask', 'initial', 'specify', 'endspecify',
  'primitive', 'endprimitive', 'table', 'endtable', 'buf', 'bufif0', 'bufif1',
  'notif0', 'notif1', 'pullup', 'pulldown', 'supply0', 'supply1', 'strong0',
  'strong1', 'weak0', 'weak1', 'highz0', 'highz1', 'tri', 'triand', 'trior',
  'tri0', 'tri1', 'trireg', 'signed', 'unsigned',
  '$clog2', '$display', '$monitor', '$time', '$finish', '$stop', '$dumpfile',
  '$dumpvars', '$readmemb', '$readmemh', '$write', '$signed', '$unsigned',
  'typedef', 'struct', 'union', 'enum', 'interface', 'endinterface', 'modport',
  'clocking', 'endclocking', 'program', 'endprogram', 'class', 'endclass',
  'virtual', 'extends', 'new', 'this', 'super', 'static', 'protected',
  'constraint', 'rand', 'randc', 'randomize',
];

function useVerilogLanguage(monaco: any) {
  useEffect(() => {
    if (!monaco) return;

    // Register Verilog language
    const langs = monaco.languages.getLanguages();
    if (!langs.find((l: any) => l.id === 'verilog')) {
      monaco.languages.register({ id: 'verilog', extensions: ['.v', '.vh'] });
    }
    if (!langs.find((l: any) => l.id === 'systemverilog')) {
      monaco.languages.register({ id: 'systemverilog', extensions: ['.sv', '.svh'] });
    }

    const tokenProvider = {
      defaultToken: '',
      keywords: verilogKeywords,
      operators: ['=', '<=', '>=', '==', '!=', '===', '!==', '&&', '||', '!',
        '&', '|', '^', '~', '+', '-', '*', '/', '%', '<<', '>>', '<<<', '>>>',
        '?', ':', ',', ';', '.', '#', '@', '(', ')', '[', ']', '{', '}'],
      tokenizer: {
        root: [
          // Comments
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          // Compiler directives
          [/`[a-zA-Z_]\w*/, 'keyword.control'],
          // System tasks/functions
          [/\$[a-zA-Z_]\w*/, 'support.function'],
          // Numbers
          [/\d+'[bodh][0-9a-fA-FxXzZ_]+/, 'number'],
          [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
          [/[0-9a-fA-F]+('[bodh])/, 'number'],
          // Strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          // Identifiers and keywords
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          }],
          // Symbols
          [/[{}()\\[\\]]/, '@brackets'],
          [/[<>]/, 'operator'],
          [/[;,.]/, 'delimiter'],
        ],
        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
      },
    };

    monaco.languages.setMonarchTokensProvider('verilog', tokenProvider as any);
    monaco.languages.setMonarchTokensProvider('systemverilog', tokenProvider as any);

    // Completion provider
    monaco.languages.registerCompletionItemProvider('verilog', {
      provideCompletionItems: (model: any, position: any) => {
        const suggestions = verilogKeywords.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: model.getWordUntilPosition(position).startColumn,
            endColumn: position.column,
          },
        }));
        return { suggestions };
      },
    });

    // Dracula theme
    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword',          foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'keyword.control',  foreground: 'ff79c6' },
        { token: 'support.function', foreground: '50fa7b' },
        { token: 'comment',          foreground: '6272a4', fontStyle: 'italic' },
        { token: 'string',           foreground: 'f1fa8c' },
        { token: 'string.invalid',   foreground: 'ff5555' },
        { token: 'number',           foreground: 'bd93f9' },
        { token: 'identifier',       foreground: 'f8f8f2' },
        { token: 'delimiter',        foreground: 'f8f8f2' },
        { token: 'operator',         foreground: 'ff79c6' },
        { token: 'type',             foreground: '8be9fd', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background':                  '#282a36',
        'editor.foreground':                  '#f8f8f2',
        'editorLineNumber.foreground':        '#6272a4',
        'editorLineNumber.activeForeground':  '#f8f8f2',
        'editor.selectionBackground':         '#44475a',
        'editor.inactiveSelectionBackground': '#44475a88',
        'editor.lineHighlightBackground':     '#44475a55',
        'editorCursor.foreground':            '#f8f8f2',
        'editorWhitespace.foreground':        '#44475a',
        'editorWidget.background':            '#21222c',
        'editorWidget.border':                '#6272a4',
        'editorSuggestWidget.background':     '#21222c',
        'editorSuggestWidget.border':         '#6272a4',
        'editorSuggestWidget.selectedBackground': '#44475a',
        'editorGutter.background':            '#282a36',
        'editorError.foreground':             '#ff5555',
        'editorWarning.foreground':           '#ffb86c',
        'editorIndentGuide.background1':      '#44475a',
        'editorIndentGuide.activeBackground1':'#6272a4',
        'editorBracketMatch.background':      '#44475a',
        'editorBracketMatch.border':          '#f8f8f2',
        'scrollbar.shadow':                   '#21222c',
        'scrollbarSlider.background':         '#44475a88',
        'scrollbarSlider.hoverBackground':    '#44475acc',
        'scrollbarSlider.activeBackground':   '#6272a4',
      },
    });
  }, [monaco]);
}

// ─── Tab Component ─────────────────────────────────────────────────────────────
function EditorTab({
  tab, isActive, onActivate, onClose,
}: { tab: Tab; isActive: boolean; onActivate: () => void; onClose: () => void }) {
  const ext = tab.name.split('.').pop()?.toLowerCase();
  const langColor = ext === 'v' ? '#5fb3f6' : ext === 'sv' ? '#a78bfa' : '#cccccc';

  return (
    <div
      className={`flex items-center gap-1 px-3 h-full cursor-pointer group border-r border-[#252526] transition-colors shrink-0 ${
        isActive
          ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#0e639c]'
          : 'bg-[#2d2d2d] text-[#858585] hover:bg-[#2a2a2a] border-t-2 border-t-transparent'
      }`}
      onClick={onActivate}
      style={{ minWidth: 100, maxWidth: 200 }}
    >
      <span
        className="shrink-0"
        style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: langColor }}
      >
        {ext?.toUpperCase()}
      </span>
      <span className="flex-1 truncate" style={{ fontSize: '12px' }}>
        {tab.name}
      </span>
      {tab.modified && <Circle size={7} className="fill-white text-white shrink-0" />}
      <button
        className="shrink-0 p-0.5 rounded hover:bg-[#3d3d3d] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ fileId }: { fileId: string }) {
  const paths: Record<string, string[]> = {
    uart_tx: ['my_soc_project', 'rtl', 'peripherals', 'uart_tx.v'],
    alu: ['my_soc_project', 'rtl', 'core', 'alu.v'],
    cpu_top: ['my_soc_project', 'rtl', 'core', 'cpu_top.v'],
    reg_file: ['my_soc_project', 'rtl', 'core', 'reg_file.v'],
  };
  const segments = paths[fileId] || ['my_soc_project', `${fileId}.v`];

  return (
    <div className="flex items-center gap-0.5 px-3 h-6 bg-[#1e1e1e] border-b border-[#3d3d3d] shrink-0">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={11} className="text-[#666]" />}
          <span
            className={`cursor-pointer hover:text-white transition-colors ${
              i === segments.length - 1 ? 'text-[#cccccc]' : 'text-[#858585]'
            }`}
            style={{ fontSize: '12px' }}
          >
            {seg}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Editor Area Component ─────────────────────────────────────────────────────
export function EditorArea({
  tabs, activeTabId, onTabChange, onTabClose, editorRef, jumpToLine, onCursorChange,
}: EditorAreaProps) {
  const monaco = useMonaco();
  useVerilogLanguage(monaco);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const code = fileContents[activeTabId] || `// ${activeTabId}\n// 文件内容加载中...\n`;

  // Build markers from problems
  useEffect(() => {
    if (!monaco) return;
    const models = monaco.editor.getModels();
    models.forEach((m: any) => {
      const issues = problemsList.filter((p) => p.fileId === activeTabId);
      const markers = issues.map((p) => ({
        severity: p.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : p.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
        startLineNumber: p.line,
        startColumn: p.column,
        endLineNumber: p.line,
        endColumn: p.column + 30,
        message: p.message,
        code: p.code,
        source: p.source,
      }));
      monaco.editor.setModelMarkers(m, 'rtl-lint', markers);
    });
  }, [monaco, activeTabId]);

  // Jump to line
  useEffect(() => {
    if (!jumpToLine || !editorRef.current) return;
    editorRef.current.revealLineInCenter(jumpToLine);
    editorRef.current.setPosition({ lineNumber: jumpToLine, column: 1 });
    editorRef.current.focus();
  }, [jumpToLine, editorRef]);

  const getLanguage = (fileId: string) => {
    if (['tb_cpu', 'tb_uart', 'tb_alu'].includes(fileId)) return 'systemverilog';
    return 'verilog';
  };

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e] items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#252526] flex items-center justify-center mx-auto mb-4">
            <span className="text-[#0e639c]" style={{ fontSize: 28, fontWeight: 700 }}>R</span>
          </div>
          <div className="text-[#cccccc] mb-1" style={{ fontSize: '20px' }}>RTL Studio</div>
          <div className="text-[#858585]" style={{ fontSize: '13px' }}>Open a file to start editing, or select one from the Explorer</div>
          <div className="mt-6 flex flex-col gap-1 text-left">
            {[
              ['Ctrl+P', 'Quick Open File'],
              ['Ctrl+Shift+P', 'Command Palette'],
              ['Ctrl+`', 'Open Terminal'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="px-2 py-0.5 bg-[#3d3d3d] rounded text-[#cccccc] border border-[#555]" style={{ fontSize: '11px' }}>{key}</kbd>
                <span className="text-[#858585]" style={{ fontSize: '12px' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-stretch h-9 bg-[#2d2d2d] overflow-x-auto shrink-0 border-b border-[#252526]">
        {tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => onTabChange(tab.id)}
            onClose={() => onTabClose(tab.id)}
          />
        ))}
        <div className="flex-1" />
        <button
          className="px-2 text-[#858585] hover:text-[#cccccc] transition-colors shrink-0"
          title="Split Editor"
        >
          <Split size={14} />
        </button>
        <button className="px-2 text-[#858585] hover:text-[#cccccc] transition-colors shrink-0">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Breadcrumb */}
      {activeTab && <Breadcrumb fileId={activeTabId} />}

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden bg-[#1a1b26]">
        <Editor
          height="100%"
          language={getLanguage(activeTabId)}
          value={code}
          theme="dracula"
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('dracula', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'keyword',          foreground: 'ff79c6', fontStyle: 'bold' },
                { token: 'keyword.control',  foreground: 'ff79c6' },
                { token: 'support.function', foreground: '50fa7b' },
                { token: 'comment',          foreground: '6272a4', fontStyle: 'italic' },
                { token: 'string',           foreground: 'f1fa8c' },
                { token: 'string.invalid',   foreground: 'ff5555' },
                { token: 'number',           foreground: 'bd93f9' },
                { token: 'identifier',       foreground: 'f8f8f2' },
                { token: 'delimiter',        foreground: 'f8f8f2' },
                { token: 'operator',         foreground: 'ff79c6' },
                { token: 'type',             foreground: '8be9fd', fontStyle: 'italic' },
              ],
              colors: {
                'editor.background':                  '#1a1b26',
                'editor.foreground':                  '#f8f8f2',
                'editorLineNumber.foreground':        '#44475a',
                'editorLineNumber.activeForeground':  '#f8f8f2',
                'editor.selectionBackground':         '#44475a',
                'editor.inactiveSelectionBackground': '#44475a66',
                'editor.lineHighlightBackground':     '#282a3688',
                'editorCursor.foreground':            '#f8f8f2',
                'editorWhitespace.foreground':        '#44475a',
                'editorWidget.background':            '#13141f',
                'editorWidget.border':                '#6272a4',
                'editorSuggestWidget.background':     '#13141f',
                'editorSuggestWidget.border':         '#6272a4',
                'editorSuggestWidget.selectedBackground': '#44475a',
                'editorGutter.background':            '#1a1b26',
                'editorError.foreground':             '#ff5555',
                'editorWarning.foreground':           '#ffb86c',
                'editorIndentGuide.background1':      '#44475a',
                'editorIndentGuide.activeBackground1':'#6272a4',
                'editorBracketMatch.background':      '#44475a',
                'editorBracketMatch.border':          '#f8f8f2',
                'scrollbar.shadow':                   '#13141f',
                'scrollbarSlider.background':         '#44475a66',
                'scrollbarSlider.hoverBackground':    '#44475aaa',
                'scrollbarSlider.activeBackground':   '#6272a4',
                'minimap.background':                 '#13141f',
              },
            });
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.onDidChangeCursorPosition((e: any) => {
              onCursorChange?.(e.position.lineNumber, e.position.column);
            });
          }}
          options={{
            fontSize: 13,
            fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
            fontLigatures: true,
            lineNumbers: 'on',
            lineNumbersMinChars: 4,
            glyphMargin: true,
            folding: true,
            foldingStrategy: 'indentation',
            minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'off',
            rulers: [80, 120],
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            suggest: { showKeywords: true, showSnippets: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            parameterHints: { enabled: true },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}