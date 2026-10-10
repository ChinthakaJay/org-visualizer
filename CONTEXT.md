# Org Visualizer

A personal map of the part of a large organization that one person works with, kept as a plain text file and drawn as nested team boxes with reporting lines.

## Language

### The file

**Org file**:
The single text file that holds every known fact about the mapped organization, one fact per line, in any order.
_Avoid_: Data file, chart file, config

### People and reporting

**Person**:
Someone the user works with or knows of, identified by a short id and belonging to at most one Team.
_Avoid_: Employee, member, node

**Manager**:
The one Person a Person reports to directly. It may be unknown.
_Avoid_: Boss, supervisor, parent

**Reporting line**:
The solid link from a Person to their Manager.
_Avoid_: Edge, arrow, reporting tree link

**Dotted line**:
A secondary, matrix-style link from a Person to someone other than their Manager. It is drawn dashed and never replaces the Reporting line.
_Avoid_: Indirect manager, functional manager

**Function**:
The kind of work a Person does, such as Engineering, Product or Ops. It belongs to the Person, not to their Team.
_Avoid_: Department, discipline, org

**Role**:
A Person's free-text job title, such as "EM" or "Director".
_Avoid_: Title, position

### Teams

**Team**:
A named group that holds People and other Teams.
_Avoid_: Group, org, department, squad

**Parent team**:
The Team that directly contains another Team. A Team with no Parent team is top-level.
_Avoid_: Org, super-team

### Partial knowledge

**Placeholder**:
A Person or Team that the Org file references but doesn't define yet. It is drawn dashed until a line defines it.
_Avoid_: Ghost, stub, unknown

### Viewing

**Collapsed team**:
A Team drawn as a single box with counts in place of its contents. This is a viewing choice and is never stored in the Org file.
_Avoid_: Hidden team, folded team

## Relationships

- A **Person** has at most one **Team**, at most one **Manager**, any number of **Dotted lines**, and at most one **Function**.
- A **Team** has at most one **Parent team**. Teams form a forest with no loops.
- The reporting tree and the team tree are independent. A Person's Manager may sit in a different Team, at any depth.
- Reporting lines into a **Collapsed team** are drawn to the collapsed box.

## Example dialogue

> **Dev:** "Hal is in Platform but reports to Carol in Risk. Should Hal be moved into Risk?"
> **Domain expert:** "No. Team and Manager are separate facts. Hal stays in Platform, and the Reporting line crosses the Team boxes."

## Flagged ambiguities

- "Role" was used for both the job title and the kind of work. Resolved: **Role** is the free-text title and **Function** is the kind of work (Engineering, Product, Ops).
