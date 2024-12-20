import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onEditorMount?: (editor: any) => void;
  className?: string;
}

export function MarkdownEditor({ value, onChange, onEditorMount, className = '' }: MarkdownEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      className={className}
      height="500px"
      theme={oneDark}
      onCreateEditor={(view) => {
        onEditorMount?.(view);
      }}
      extensions={[
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
      ]}
    />
  );
}