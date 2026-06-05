---
title: How to Use
---

# How to Use

This wiki has two primary tools for finding information: **Search**, for keyword-based lookup of specific clauses, and **Ask AI**, for getting plain-language answers to questions. On individual clause pages, a set of additional tools is available for working with and saving content.

## Search

The Search modal is opened from the navigation bar and provides fast, filtered access to every clause page in the wiki.

### Opening search

Click the **Search** bar in the top navigation, or use a keyboard shortcut:

| Action | Shortcut |
|---|---|
| Open search | `/` |
| Navigate results | `↑` `↓` arrow keys |
| Open a highlighted result | `Enter` |
| Close search | `Esc` |
| Show keyboard help | `?` |

### Filters

Below the search input, two filter dropdowns allow you to narrow results before or after typing a query.

**Filter by EBA** restricts results to a single Enterprise Agreement. This is most useful when you already know which agreement covers the employee you are advising.

**Filter by Topic** restricts results by subject area. Useful when you know the general topic but not the specific clause number. Available topics include:

`allowances` · `classification` · `consultation` · `dispute-resolution` · `employment-types` · `hours-of-work` · `leave` · `overtime` · `penalty-rates` · `professional-development` · `termination` · `wages` · `workload`

You can combine a keyword, an EBA filter, and a Topic filter. A page must satisfy all active conditions to appear in results.

::: tip Example
To find wage-related pages for Nurses and Midwives only, open Search, select **Nurses and Midwives 2024–2028** from the EBA dropdown, then select **wages** from the Topic dropdown.
:::

Active filters appear as dismissible pills below the dropdowns. Click the **×** on any pill to remove that filter, or **Clear all** to remove all at once.

### Search operators

In addition to the filter dropdowns, you can apply filters directly in the search box using typed operators. Type a colon (`:`) to see the full list of available operators and examples.

| Operator | Purpose | Example |
|---|---|---|
| `eba:` | Filter to one EBA | `eba:nurses overtime` |
| `topic:` | Filter by topic | `topic:wages` |
| `clause:` | Find by clause number | `clause:42` |
| `-word` | Exclude a word | `allowance -meal` |
| `"phrase"` | Match an exact phrase | `"ordinary time"` |

As you type an operator, an **autocomplete dropdown** appears with matching EBA slugs or topic values. Use `↑` and `↓` to navigate the suggestions and `Enter` to apply one. Press `Esc` to dismiss without applying.

Operators and dropdown filters can be combined. When both are active, each appears as a separate pill in the active filters bar so you can see and remove them independently.

### Search settings

Click the **gear icon** (⚙) at the right of the search input to open the settings panel. Settings are organised into three groups:

**Search behaviour**
- **Default EBA** — set an EBA that is pre-selected every time you open search. Useful if you regularly advise employees under the same agreement.

**Display**
- **Compact results** — reduces the vertical height of each result card for denser browsing.
- **Floating preview pane** — shows or hides the desktop preview pane (see below).

**Privacy**
- **Remember searches between visits** — opts in to saving your search history across browser sessions. Off by default; searches are session-only unless you enable this.
- **Share anonymous search analytics** — opts in to contributing anonymous usage data to help improve the wiki.

### Result cards

Results are ranked by relevance. Each card shows:

- the **clause title**
- the **EBA** the page belongs to, shown as a coloured pill
- a **section / clause breadcrumb**
- a **highlighted excerpt** showing where your search term appears
- any matching **topic tags**

Every clause page also carries search synonyms alongside formal EBA terminology, so everyday language still leads you to the right page.

| If you search for… | You may find… |
|---|---|
| `sick day`, `off crook` | Personal Leave |
| `time off for a funeral` | Compassionate Leave / Ceremonial Leave |
| `after hours phone calls` | Right to Disconnect |
| `called back to work` | Recall to Duty / Overtime |
| `free meals`, `fed at work` | Meal Allowance |
| `weekend penalty` | Penalty Rates / Saturday / Sunday loadings |
| `study leave`, `course fees` | Professional Development / Education Leave |
| `extra pay for qualifications` | Higher Qualifications Allowance / Top of Band |

### Recently viewed and bookmarks

When the search modal opens with no active query, the idle panel shows:

- **Recently viewed** — the last four clause pages you visited, listed with their EBA pill. Persists across browser sessions.
- **My bookmarks** — up to three of your saved bookmarks, with the clause title and EBA. See [Bookmarks](#bookmarks) below for how to save them.

Click any entry to navigate directly to that page.

### Desktop preview pane

On a desktop browser, hovering over or focusing on a search result opens a **preview pane** to the right of the modal. The preview shows the page title, EBA, breadcrumb, excerpt, and topic tags, letting you inspect a result before opening it. The preview pane can be disabled in search settings. It does not appear on mobile.

### No results and fuzzy matching

If your search returns no direct matches, the search will automatically try a **similar term**. If a close match is found, results are shown with a "Showing results for **X** instead" note.

If no results can be found at all, a set of AI-generated suggestion chips appears. Clicking a suggestion opens a **streaming AI answer** directly inside the search modal without leaving it. To return to keyword results, click **Back to results**.

## Ask AI

Ask AI is a conversational assistant that reads wiki content and answers questions in plain language. It is available from any page at any time.

### Opening Ask AI

Click the **Ask AI** button in the top navigation bar to open the AI panel.

On desktop, the panel slides in from the right side of the screen. On mobile, it opens as a bottom sheet. To close the panel, click **✕** in the panel header or press `Esc`.

### Asking about a specific clause

When reading a clause page, click **Ask about this page** in the toolbar below the page title. This opens the AI panel pre-loaded with the context of that specific clause — the AI scopes its answer to the clause you are currently reading.

A page context chip at the bottom of the panel shows which clause is loaded. You can dismiss it at any time to switch back to wiki-wide mode.

### Context and filters

Two optional filters are available in each chat:

- **EBA** — restricts answers to a specific agreement
- **Employment type** — tailors the answer to a specific employment category (full-time, part-time, casual, fixed-term, or sessional)

These filters are stored per chat and persist with that chat's history. Providing them significantly improves the accuracy of answers.

### Chat history

The panel maintains a history of up to **10 chats**, stored in your browser. To switch between chats or start a new one, click the chat title in the panel header to open the chat dropdown.

From the dropdown you can:

- select a previous chat to resume it
- start a **new chat** using the + button
- **clear all chats**

Each chat retains its own messages, filters, and page context independently.

### Sources and follow-up

After an answer is returned, a **Sources** section appears below it. Each source is a hyperlink to the clause page the answer relied on. The source pages are the authoritative text — always read the linked clauses in full before acting on any AI-generated answer.

To ask a follow-up question, type directly into the input box. The AI retains the context of the current conversation (up to the last three exchanges) so you do not need to repeat background details.

To start fresh on a new topic, open the chat dropdown and start a new chat.

::: warning Before acting on any answer
Ask AI is a research aid, not a substitute for reading the clause itself. Answers are generated from wiki content only and may contain errors. Always verify the cited clause and source pages before acting on or sharing any AI-generated response.
:::

## Clause pages

### Toolbar

On every clause page, a toolbar appears immediately below the page title. It contains four actions:

| Action | What it does |
|---|---|
| **Ask about this page** | Opens the AI panel scoped to this clause |
| **Copy** | Copies the full clause content to your clipboard, formatted for pasting into email or Jira |
| **View as Markdown** | Copies the clause content as plain Markdown text |
| **Bookmark this page** | Saves this clause to your bookmarks |

### Bookmarks

Click **Bookmark this page** in the toolbar to save a clause. A dialog opens where you can add a personal note to the bookmark before saving. To edit the note or remove the bookmark, click the button again on the same page — it will show as **Bookmarked** when active.

Bookmarks are stored in your browser and persist across sessions. Up to three of your most recent bookmarks are shown in the search modal's idle panel for quick access.

### Clause panel

Wherever a clause number appears as a hyperlink — in cross-references within clause text, in the related clauses panel, and elsewhere — clicking it opens the clause in a **slide-in side panel** rather than navigating away. This allows you to read a referenced clause without losing your place in the current page.

To close the panel, click **✕** or click anywhere outside it.

### Related clauses

Below each clause, a **Related clauses** panel surfaces clauses from across all EBAs that cover similar topics or content. This is generated automatically.

Clicking any related clause card opens it in the clause panel described above.

### Legislation references

When a clause references an Act of Parliament — such as the *Fair Work Act 2009* or the *National Employment Standards* — those references are automatically detected. A **Legislation** panel appears below the clause, linking each reference directly to the relevant provision on the Federal Register of Legislation.


## Accessibility and display

### Text size and display options

Click the **Aa** button in the navigation bar to open the accessibility panel. The following settings are available:

- **Text size** — cycles through normal, large, and extra-large
- **Line spacing** — increases space between lines
- **Letter spacing** — increases space between characters
- **OpenDyslexic font** — switches to the OpenDyslexic typeface
- **Highlight links** — underlines and highlights all hyperlinks on the page
- **High contrast** — increases colour contrast throughout
- **Reduce motion** — disables transitions and animations

All settings persist across page navigation and browser sessions.

### Reading mode

Reading mode is available inside the accessibility panel. It hides the sidebar, navigation bar, toolbar, related clauses panel, and legislation panel, then reflows the page content into a single centred reading column for distraction-free browsing.

Reading mode applies to the current page only and resets when you navigate to another page.

### Dark mode

Toggle between light and dark mode using the **sun/moon icon** in the navigation bar. On mobile, this control is inside the hamburger menu at the top right.

## Keyboard shortcuts

Press `?` anywhere on the wiki — except when a text input or search box is focused — to open the full keyboard shortcut reference. Common shortcuts are listed below.

| Action | Shortcut |
|---|---|
| Open search | `/` |
| Open AI Pane | `CTRL` + `K` |
| Navigate search results | `↑` `↓` |
| Open selected result | `Enter` |
| Close modal or panel | `Esc` |
| Jump to EBA (search open) | `Shift` + `F1` – `F9` |
| Show shortcut help | `?` |

## Archive

The default search covers only current, active Enterprise Agreements.

Once an agreement is superseded by a newer one, it will be moved to the Archive. An Archive search will be available at that point, allowing you to look up historical entitlements — for example, to interpret something that occurred under a previous agreement — without it appearing in the main search results.