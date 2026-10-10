# The Org file editor stays on CodeMirror 6, not Monaco

When we added Find, Replace and Format to the editor, we kept CodeMirror 6 and used its official `@codemirror/search` package instead of switching to Monaco, which has these built in. No editor knows the Org file syntax, so the Format rules are our own code whichever editor we use. Moving to Monaco would have meant a multi-MB bundle with web workers and porting the syntax highlighting, lint markers, the `EditorHandle` methods and the Help walkthroughs, all to gain little beyond a command palette.
