import { useEffect } from 'react';

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

const assemblyKeywords = [
  'mov', 'add', 'sub', 'mul', 'div', 'and', 'orr', 'eor', 'xor', 'not', 'cmp', 'cmn',
  'tst', 'teq', 'b', 'bl', 'bx', 'beq', 'bne', 'bgt', 'blt', 'bge', 'ble', 'jmp', 'call',
  'ret', 'push', 'pop', 'ldr', 'ldrb', 'ldrh', 'str', 'strb', 'strh', 'lea', 'nop', 'svc',
  'syscall', 'section', 'global', 'globl', 'extern', 'equ', 'byte', 'word', 'long', 'quad',
  'ascii', 'asciz', 'string', 'align', 'space', 'fill', 'org', 'macro', 'endm', 'include',
];

const assemblyRegisters = [
  'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13',
  'r14', 'r15', 'sp', 'lr', 'pc', 'a0', 'a1', 'a2', 'a3', 'v0', 'v1', 't0', 't1', 't2',
  't3', 't4', 't5', 't6', 't7', 't8', 't9', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
  'ra', 'fp', 'gp', 'ip', 'x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10',
  'x11', 'x12', 'x13', 'x14', 'x15', 'x16', 'x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
  'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'zr',
];

const shellKeywords = [
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac',
  'function', 'in', 'select', 'time', 'coproc', 'readonly', 'local', 'export', 'unset', 'return',
  'break', 'continue', 'shift', 'trap', 'source', 'alias', 'eval', 'exec', 'exit', 'test',
];

const tclKeywords = [
  'set', 'unset', 'proc', 'return', 'if', 'elseif', 'else', 'while', 'for', 'foreach', 'switch',
  'break', 'continue', 'uplevel', 'upvar', 'global', 'variable', 'namespace', 'eval', 'expr',
  'format', 'puts', 'source', 'file', 'list', 'dict', 'lindex', 'llength', 'append', 'incr',
];

const constraintKeywords = [
  'create_clock', 'create_generated_clock', 'set_clock_groups', 'set_false_path', 'set_max_delay',
  'set_min_delay', 'set_multicycle_path', 'set_input_delay', 'set_output_delay', 'set_property',
  'get_ports', 'get_pins', 'get_cells', 'get_nets', 'get_clocks', 'current_design', 'current_instance',
];

const makefileKeywords = [
  'include', 'ifdef', 'ifndef', 'ifeq', 'ifneq', 'else', 'endif', 'override', 'export', 'unexport',
  'define', 'endef', 'undefine', 'private', 'vpath', 'load', 'sinclude', '-include', 'call', 'eval',
  'foreach', 'if', 'or', 'and', 'shell', 'wildcard', 'patsubst', 'subst', 'filter', 'filter-out',
  'sort', 'word', 'wordlist', 'words', 'firstword', 'lastword', 'dir', 'notdir', 'basename', 'suffix',
  'addprefix', 'addsuffix', 'join', 'abspath', 'realpath', 'origin', 'flavor', 'value',
];

const shellCommandKeywords = [
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac',
  'in', 'function', 'select', 'time', 'coproc', 'break', 'continue', 'return', 'export',
  'unset', 'readonly', 'local', 'alias', 'eval', 'exec', 'exit', 'test',
];

function createRange(model: any, position: any) {
  const currentWord = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: currentWord.startColumn,
    endColumn: position.column,
  };
}

function createKeywordSuggestions(monaco: any, keywords: string[], model: any, position: any) {
  const range = createRange(model, position);
  return keywords.map((keyword) => ({
    label: keyword,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: keyword,
    range,
  }));
}

export function registerEditorLanguages(monaco: any): void {
  if (!monaco) {
    return;
  }

  const languages = monaco.languages.getLanguages();
  if (!languages.find((language: any) => language.id === 'verilog')) {
    monaco.languages.register({ id: 'verilog', extensions: ['.v', '.vh'] });
  }
  if (!languages.find((language: any) => language.id === 'systemverilog')) {
    monaco.languages.register({ id: 'systemverilog', extensions: ['.sv', '.svh'] });
  }
  if (!languages.find((language: any) => language.id === 'assembly')) {
    monaco.languages.register({ id: 'assembly', extensions: ['.s', '.S'] });
  }
  if (!languages.find((language: any) => language.id === 'shell')) {
    monaco.languages.register({ id: 'shell', extensions: ['.sh'] });
  }
  if (!languages.find((language: any) => language.id === 'tcl')) {
    monaco.languages.register({ id: 'tcl', extensions: ['.tcl'] });
  }
  if (!languages.find((language: any) => language.id === 'constraints')) {
    monaco.languages.register({ id: 'constraints', extensions: ['.xdc', '.sdc'] });
  }
  if (!languages.find((language: any) => language.id === 'makefile')) {
    monaco.languages.register({ id: 'makefile', extensions: ['.mk'], filenames: ['Makefile'] });
  }

  const verilogTokenProvider = {
    defaultToken: '',
    keywords: verilogKeywords,
    operators: ['=', '<=', '>=', '==', '!=', '===', '!==', '&&', '||', '!', '&', '|', '^', '~', '+', '-', '*', '/', '%', '<<', '>>', '<<<', '>>>', '?', ':', ',', ';', '.', '#', '@', '(', ')', '[', ']', '{', '}'],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/`[a-zA-Z_]\w*/, 'keyword.control'],
        [/\$[a-zA-Z_]\w*/, 'support.function'],
        [/\d+'[bodh][0-9a-fA-FxXzZ_]+/, 'number'],
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/[0-9a-fA-F]+('[bodh])/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[{}()\[\]]/, '@brackets'],
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

  const assemblyTokenProvider = {
    defaultToken: '',
    keywords: assemblyKeywords,
    registers: assemblyRegisters,
    tokenizer: {
      root: [
        [/^[A-Za-z_.$][\w.$]*:/, 'type'],
        [/[;#].*$/, 'comment'],
        [/\/\/.+$/, 'comment'],
        [/\.[A-Za-z_][\w.]*/, 'keyword.control'],
        [/[%$@][A-Za-z_][\w]*/, 'variable'],
        [/0x[0-9a-fA-F]+/, 'number'],
        [/\b\d+\b/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/[A-Za-z_.][\w.]*/, { cases: { '@keywords': 'keyword', '@registers': 'type', '@default': 'identifier' } }],
        [/[{}()\[\]]/, '@brackets'],
        [/[,:]/, 'delimiter'],
        [/[+-/*%&|^~!=<>]+/, 'operator'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  };

  const shellTokenProvider = {
    defaultToken: '',
    keywords: shellKeywords,
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\$\{?[A-Za-z_][\w]*\}?/, 'variable'],
        [/\b\d+\b/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'[^']*'/, 'string'],
        [/[A-Za-z_][\w-]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[|&;()<>]/, 'operator'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  };

  const tclTokenProvider = {
    defaultToken: '',
    keywords: tclKeywords,
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\$\{?[A-Za-z_][\w:]*\}?/, 'variable'],
        [/\b\d+\b/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/-[A-Za-z_][\w-]*/, 'type'],
        [/[A-Za-z_][\w:]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[{}\[\]]/, '@brackets'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  };

  const constraintsTokenProvider = {
    defaultToken: '',
    keywords: constraintKeywords,
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\$\{?[A-Za-z_][\w:]*\}?/, 'variable'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/-[A-Za-z_][\w-]*/, 'type'],
        [/[A-Za-z_][\w:]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[{}\[\]]/, '@brackets'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  };

  const makefileTokenProvider = {
    defaultToken: '',
    keywords: makefileKeywords,
    shellCommandKeywords,
    tokenizer: {
      root: [
        [/^\s*#.*$/, 'comment'],
        [/^\t+/, 'meta.recipe', '@recipeCommand'],
        [/^(\s*)([A-Za-z0-9_.%/\-]+)(\s*)(:=)/, ['', 'variable', '', 'operator.assignment.immediate'], '@assignmentValue'],
        [/^(\s*)([A-Za-z0-9_.%/\-]+)(\s*)(\+=)/, ['', 'variable', '', 'operator.assignment.append'], '@assignmentValue'],
        [/^(\s*)([A-Za-z0-9_.%/\-]+)(\s*)(\?=)/, ['', 'variable', '', 'operator.assignment.conditional'], '@assignmentValue'],
        [/^(\s*)([A-Za-z0-9_.%/\-]+)(\s*)(=)/, ['', 'variable', '', 'operator.assignment.recursive'], '@assignmentValue'],
        [/^(\s*)([A-Za-z0-9_.%/\-]+)(\s*)(::?)/, ['', 'type', '', 'delimiter'], '@prerequisites'],
        [/\$\(/, 'variable', '@makeVariable'],
        [/\$\{/, 'variable', '@makeBracedVariable'],
        [/\$(?:[@%<?^*+|])/, 'variable.automatic'],
        [/\b\d+\b/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/-[A-Za-z_][\w-]*/, 'type'],
        [/[A-Za-z_][\w-]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[|&;()<>]+/, 'operator'],
      ],
      prerequisites: [
        [/\$\(/, 'variable', '@makeVariable'],
        [/\$\{/, 'variable', '@makeBracedVariable'],
        [/\$(?:[@%<?^*+|])/, 'variable.automatic'],
        [/\|/, 'operator'],
        [/^\s*#.*$/, 'comment', '@pop'],
        [/[A-Za-z0-9_.%/\-]+/, 'identifier'],
        [/\s+/, ''],
        [/$/, '', '@pop'],
      ],
      assignmentValue: [
        [/\$\(/, 'variable', '@makeVariable'],
        [/\$\{/, 'variable', '@makeBracedVariable'],
        [/\$(?:[@%<?^*+|])/, 'variable.automatic'],
        [/^\s*#.*$/, 'comment', '@pop'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'[^']*'/, 'string'],
        [/\b\d+\b/, 'number'],
        [/[A-Za-z_][\w./-]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[|&;()<>]+/, 'operator'],
        [/\s+/, ''],
        [/$/, '', '@pop'],
      ],
      makeVariable: [
        [/\$\(/, 'variable', '@push'],
        [/\$\{/, 'variable', '@makeBracedVariable'],
        [/\)/, 'variable', '@pop'],
        [/[^$(){}]+/, 'variable'],
        [/[$(){}]/, 'variable'],
      ],
      makeBracedVariable: [
        [/\$\{/, 'variable', '@push'],
        [/\$\(/, 'variable', '@makeVariable'],
        [/\}/, 'variable', '@pop'],
        [/[^$(){}]+/, 'variable'],
        [/[$(){}]/, 'variable'],
      ],
      recipeCommand: [
        [/\$\(/, 'variable', '@makeVariable'],
        [/\$\{/, 'variable', '@makeBracedVariable'],
        [/\$(?:[@%<?^*+|])/, 'variable.automatic'],
        [/\$\$\{?[A-Za-z_][\w]*\}?/, 'variable.shell'],
        [/^\s*#.*$/, 'comment', '@pop'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'[^']*'/, 'string'],
        [/\b\d+\b/, 'number'],
        [/[A-Za-z_][\w./-]*/, { cases: { '@shellCommandKeywords': 'keyword', '@default': 'support.function.shell' } }, '@recipe'],
        [/[;&|]+/, 'operator'],
        [/\s+/, ''],
        [/$/, '', '@pop'],
      ],
      recipe: [
        [/\$\(/, 'variable', '@makeVariable'],
        [/\$\{/, 'variable', '@makeBracedVariable'],
        [/\$(?:[@%<?^*+|])/, 'variable.automatic'],
        [/\$\$\{?[A-Za-z_][\w]*\}?/, 'variable.shell'],
        [/^\s*#.*$/, 'comment', '@pop'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'[^']*'/, 'string'],
        [/\b\d+\b/, 'number'],
        [/[A-Za-z_][\w./-]*/, { cases: { '@shellCommandKeywords': 'keyword', '@default': 'identifier' } }],
        [/[;&|]+/, 'operator', '@recipeCommand'],
        [/\s+/, ''],
        [/$/, '', '@pop'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  };

  monaco.languages.setMonarchTokensProvider('verilog', verilogTokenProvider as any);
  monaco.languages.setMonarchTokensProvider('systemverilog', verilogTokenProvider as any);
  monaco.languages.setMonarchTokensProvider('assembly', assemblyTokenProvider as any);
  monaco.languages.setMonarchTokensProvider('shell', shellTokenProvider as any);
  monaco.languages.setMonarchTokensProvider('tcl', tclTokenProvider as any);
  monaco.languages.setMonarchTokensProvider('constraints', constraintsTokenProvider as any);
  monaco.languages.setMonarchTokensProvider('makefile', makefileTokenProvider as any);

  monaco.languages.registerCompletionItemProvider('verilog', {
    provideCompletionItems: (model: any, position: any) => ({ suggestions: createKeywordSuggestions(monaco, verilogKeywords, model, position) }),
  });

  monaco.languages.registerCompletionItemProvider('assembly', {
    provideCompletionItems: (model: any, position: any) => {
      const range = createRange(model, position);
      const registerSuggestions = assemblyRegisters.map((register) => ({
        label: register,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: register,
        range,
      }));

      return {
        suggestions: [
          ...createKeywordSuggestions(monaco, assemblyKeywords, model, position),
          ...registerSuggestions,
        ],
      };
    },
  });

  monaco.languages.registerCompletionItemProvider('shell', {
    provideCompletionItems: (model: any, position: any) => ({ suggestions: createKeywordSuggestions(monaco, shellKeywords, model, position) }),
  });

  monaco.languages.registerCompletionItemProvider('tcl', {
    provideCompletionItems: (model: any, position: any) => ({ suggestions: createKeywordSuggestions(monaco, tclKeywords, model, position) }),
  });

  monaco.languages.registerCompletionItemProvider('constraints', {
    provideCompletionItems: (model: any, position: any) => ({ suggestions: createKeywordSuggestions(monaco, constraintKeywords, model, position) }),
  });

  monaco.languages.registerCompletionItemProvider('makefile', {
    provideCompletionItems: (model: any, position: any) => ({ suggestions: createKeywordSuggestions(monaco, makefileKeywords, model, position) }),
  });
}

export function useRegisterEditorLanguages(monaco: any): void {
  useEffect(() => {
    registerEditorLanguages(monaco);
  }, [monaco]);
}