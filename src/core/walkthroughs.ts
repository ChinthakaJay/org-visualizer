import { addLine, setField, type TextEdit } from './edits';

/** What a walkthrough step did: the new text and the line that changed, or a note when it isn't one line. */
export interface StepResult extends TextEdit {
  /** Explains a step that isn't a single-line edit. */
  note?: string;
  /** For view-only steps: the Teams to show collapsed afterwards. */
  collapse?: string[];
}

export interface WalkthroughStep {
  label: string;
  run(text: string): StepResult;
}

export interface Walkthrough {
  name: string;
  description: string;
  steps: WalkthroughStep[];
}

/** Each real-world change, step by step, as edits to the Help sandbox's sample Org file. */
export const WALKTHROUGHS: Walkthrough[] = [
  {
    name: 'New Manager',
    description:
      'Alice used to report to Bob. After a shuffle she reports to Carol. Watch the Reporting line move. Alice stays in Payments, because Team and Manager are separate facts.',
    steps: [{ label: 'Alice now reports to Carol', run: (t) => setField(t, 'person', 'alice', 'reports', 'carol') }],
  },
  {
    name: 'Person changes Team',
    description:
      'Eve moves from Risk to Payments but keeps her Manager. Her card jumps into Payments, and her Reporting line now crosses Team boxes.',
    steps: [{ label: 'Eve moves to Payments', run: (t) => setField(t, 'person', 'eve', 'team', 'payments') }],
  },
  {
    name: 'Team re-org',
    description:
      "Whole Teams move with everyone in them. Each move is one edit to a Team line; nobody's own line changes.",
    steps: [
      { label: 'Cards moves under Platform', run: (t) => setField(t, 'team', 'cards', 'parent', 'platform') },
      { label: 'Risk moves under Payments', run: (t) => setField(t, 'team', 'risk', 'parent', 'payments') },
      {
        label: 'A new top-level Team, Group Tech, holds FinTech and Platform',
        run: (t) => {
          let r = addLine(t, 'team group    : Group Tech');
          r = setField(r.text, 'team', 'fintech', 'parent', 'group');
          r = setField(r.text, 'team', 'platform', 'parent', 'group');
          return { text: r.text, line: null, before: null, after: null, note: 'One new Team line, plus parent=group on the FinTech and Platform lines.' };
        },
      },
    ],
  },
  {
    name: 'Partial knowledge',
    description:
      "You meet someone whose Manager and Team you only know by name. They're drawn as dashed Placeholders, and become real as soon as you add their lines.",
    steps: [
      { label: 'Add Ivy (Team "ml", reports to "kai"; neither is defined yet)', run: (t) => addLine(t, 'ivy   : Ivy Chen    | team=ml | reports=kai') },
      { label: 'Now you learn about Kai', run: (t) => addLine(t, 'kai   : Kai Wu      | team=ml | role=Head of ML') },
      { label: 'And that ML sits under Platform', run: (t) => addLine(t, 'team ml       : Machine Learning | parent=platform') },
      { label: "And who Frank (Eve's Manager) is", run: (t) => addLine(t, 'frank : Frank Ode   | team=risk | role=Risk Lead') },
    ],
  },
  {
    name: 'Mistakes',
    description:
      'What happens when the file says something impossible or misspelt. The chart still draws, and each Problem points at its line.',
    steps: [
      { label: 'Typo: Dan\'s Team is "paymnts"', run: (t) => setField(t, 'person', 'dan', 'team', 'paymnts') },
      { label: 'Loop: FinTech is put inside Cards (which is inside FinTech)', run: (t) => setField(t, 'team', 'fintech', 'parent', 'cards') },
      { label: 'Loop: Bob reports to Dan (who reports up to Bob)', run: (t) => setField(t, 'person', 'bob', 'reports', 'dan') },
      { label: 'Duplicate: a second line for Alice', run: (t) => addLine(t, 'alice : Alice Smith | team=risk') },
    ],
  },
  {
    name: 'Dotted line',
    description:
      'Gia, a PM, reports to Alice but also works closely with Carol and with the product VP. Dotted lines record that matrix link without replacing her Reporting line.',
    steps: [
      { label: 'Gia gets a Dotted line to Carol', run: (t) => setField(t, 'person', 'gia', 'dotted', 'carol') },
      { label: 'Add Vera, the product VP', run: (t) => addLine(t, 'vp    : Vera Patel  | role=VP Product | fn=product') },
      { label: 'Gia gets a second Dotted line, to Vera', run: (t) => setField(t, 'person', 'gia', 'dotted', 'carol,vp') },
    ],
  },
  {
    name: 'Function',
    description:
      "A Function is the kind of work someone does, shown as a small badge on their card. It's any word you like, and it belongs to the Person, not their Team.",
    steps: [
      { label: 'Hal works in Ops', run: (t) => setField(t, 'person', 'hal', 'fn', 'ops') },
      { label: 'Dan moves from engineering to data', run: (t) => setField(t, 'person', 'dan', 'fn', 'data') },
    ],
  },
  {
    name: 'Team colour',
    description:
      'Each top-level Team picks its own colour, and sub-teams take shades of it. A color= on a Team overrides that for it and everything inside it.',
    steps: [
      { label: 'FinTech goes purple, and its sub-teams follow', run: (t) => setField(t, 'team', 'fintech', 'color', 'purple') },
      { label: 'Cards stands out in its own red', run: (t) => setField(t, 'team', 'cards', 'color', '#e11d48') },
    ],
  },
  {
    name: 'Collapse and expand',
    description:
      'Collapsing hides detail you don\'t need right now. It\'s a viewing choice: the Org file never changes, and lines into a Collapsed team end at its box.',
    steps: [
      {
        label: 'Collapse Payments',
        run: (t) => ({ text: t, line: null, before: null, after: null, collapse: ['payments'], note: 'No line changes. Payments shows its counts, and Bob\'s Reporting line now ends at its box.' }),
      },
      {
        label: 'Collapse FinTech too',
        run: (t) => ({ text: t, line: null, before: null, after: null, collapse: ['fintech', 'payments'], note: 'No line changes. Hal\'s Reporting line from Carol now starts at the FinTech box.' }),
      },
      {
        label: 'Expand everything',
        run: (t) => ({ text: t, line: null, before: null, after: null, collapse: [], note: 'No line changes. Click any Team header to collapse it, or a Collapsed team to expand it.' }),
      },
    ],
  },
];
