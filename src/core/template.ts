/** The text a new Org file starts with. Help opens automatically while the file still equals it. */
export const TEMPLATE = `# My org: one fact per line, in any order. Lines starting with # are comments.
#
# Teams:   team <id> : <Title> | parent=<team-id>
# People:  <id> : <Name> | team=<team-id> | reports=<manager-id or ?>
#
# Open Help (top right) for the full syntax and walkthroughs.

team example : Example Team
me : Me | team=example
`;
