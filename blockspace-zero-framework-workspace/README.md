# Blockspace — Zero-Framework Notion-Style Workspace

A lightweight Kanban/workspace built with only HTML, CSS, and vanilla JavaScript.

## Core requirements implemented

- Native HTML5 Drag & Drop API (`dragstart`, `dragover`, `dragleave`, `drop`, `dragend`)
- Dynamic DOM creation with `document.createElement`
- Batch DOM updates with `DocumentFragment`
- Inline editing with `contenteditable`
- Centralized `state` object
- Persistent browser storage with `localStorage`, `JSON.stringify`, and `JSON.parse`
- Create/delete columns
- Create/delete task cards
- Edit task title and description inline
- Toggle completion
- Reorder cards inside a column
- Move cards between columns
- Persistent reload/tab-close state
- Responsive layout

## Run

Open `index.html` directly in a browser. No package manager, server, build command, or dependency installation is required.

## Suggested Week 2 extensions

1. Add keyboard shortcuts for creating cards and columns.
2. Add a search/filter bar.
3. Add due dates and priorities.
4. Persist a card history/activity log.
5. Add cross-column column reordering.
6. Add import/export JSON.
