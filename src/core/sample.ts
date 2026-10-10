/** The Help sandbox's sample Org file. The walkthroughs start from it. */
export const SAMPLE = `# org.txt: one fact per line, in any order
# teams:   team <id> : <Title> | parent=<team-id> | color=<name or #hex>
team fintech  : FinTech
team platform : Platform
team payments : Payments  | parent=fintech
team risk     : Risk      | parent=fintech
team cards    : Cards     | parent=payments

# people:  <id> : <Name> | team=<team-id> | reports=<person-id or ?> | role=… | fn=… | dotted=<id>,…
bob   : Bob Jones   | team=fintech  | role=Director | fn=eng
alice : Alice Smith | team=payments | reports=bob   | role=EM | fn=eng
dan   : Dan Ruiz    | team=cards    | reports=alice | fn=eng
gia   : Gia Lam     | team=cards    | reports=alice | role=PM | fn=product
carol : Carol Lee   | team=risk     | reports=bob   | role=Risk EM | fn=eng
eve   : Eve Park    | team=risk     | reports=frank   # frank not listed yet
hal   : Hal Ng      | team=platform | reports=carol   # reports across teams
zoe   : Zoe Kim     | reports=?                       # team and manager unknown
`;
