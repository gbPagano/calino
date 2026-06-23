# CardDAV CRUD UI Plan

## Decisions

1. **"+" New" address book picker:** If >1 visible address book, show a dropdown picker; if exactly 1, go straight to the form.
2. **Inline edit:** Goes through pending queue (async, eventual consistency) — same as create/edit form.
3. **Form modal:** 560px wide, scrollable body.
4. **Photo upload:** Skipped in v1.
5. **Groups (isGroup/memberUids):** Skipped in v1.

## File changes

### 1. `src/features/carddav/components/ContactsView.tsx`
- Add state: `isFormOpen`, `editingContact: Contact | null`, `showAddressBookPicker`
- Add `addressBookPickerRef` for positioning the dropdown
- Render `<ContactFormModal>` when form is open
- Wire up: `onNew`, `onEdit`, `onDelete`, `onFieldSave`
- **+ New flow:** if 1 address book → open form immediately; if >1 → show inline dropdown with address book names, click one → open form
- **Edit flow:** `onEdit(contact)` → opens form pre-filled
- **Delete flow:** `onDelete(contact)` → adds pending delete, triggers sync
- **Field save flow:** `onFieldSave(id, field, value)` → updates store, adds pending update

### 2. `src/features/carddav/components/ContactFormModal.tsx` (NEW)
Reuses `Modal.tsx` + `EventModal.module.css` class names.

```ts
interface ContactFormModalProps {
  isOpen: boolean
  onClose: () => void
  contact: Contact | null   // null = create mode
  addressBookId: string
  onSave: (contact: Contact) => void
  onDelete?: (contact: Contact) => void
}
```

**Layout:**
- Width: 560px, max-height 90vh, overflow-y auto
- Header: serif title input (like EventModal)
- Body: `<ContactFormFields>` (scrollable)
- Footer: [Delete (edit mode only)] [Cancel] [Save]

**On save:** Build Contact object → call `onSave`
**On delete:** Call `onDelete` → close modal
**On cancel:** Call `onClose`

### 3. `src/features/carddav/components/ContactFormFields.tsx` (NEW)
Reuses `EventModal.module.css` class names: `.modalBody`, `.modalField`, `.label`, `.row`, `.input`, `.select`, `.checkbox`, `.modalTextarea`, `.modalFieldRow`, etc.

```ts
interface ContactFormFieldsProps {
  value: Partial<Contact>
  onChange: (contact: Partial<Contact>) => void
}
```

**Local state:** `Partial<Contact>` derived from props, updated on field change, communicated up via `onChange`.

**Fields (in order):**
1. **Name block** (full width)
   - Given name + Family name (side by side)
   - Additional names, Prefixes, Suffixes (collapsible "More")
2. **Organization block** (full width)
   - Organization + Department (side by side)
   - Role/Title
3. **Contact info block** (full width)
   - Emails: [type dropdown] [email input] [+ Add] — list
   - Phones: [type dropdown] [phone input] [+ Add] — list
   - Addresses: [type dropdown] + full address fields + [+ Add] — list (collapsible per entry)
   - URLs: [type dropdown] [url input] [+ Add] — list
4. **Personal block** (full width)
   - Birthday (date input)
5. **Notes block** (full width)
   - Note (textarea)

**CSS:** Uses `var(--color-bg-tertiary)`, `var(--radius-sm)`, `var(--color-border-visible)`, `var(--accent)` for focus.

### 4. `src/features/carddav/components/ContactDetail.tsx`
- `onEdit?: () => void` prop
- `onDelete?: () => void` prop
- `onFieldSave?: (field: string, value: unknown) => void` prop
- Remove `disabled` from edit/delete buttons, wire up props
- **Inline double-click edit** for name in hero and each info field:
  ```
  <span className={styles.infoFieldValue} onDoubleClick={() => setEditing(field, value)}>
    {displayValue}
  </span>
  ```
  When editing: `<input className={styles.inlineInput} value={value} onBlur={save} onKeyDown={handleKey} />`
  - Enter/blur → save (call `onFieldSave`)
  - Escape → revert (clear editing state, restore original value)
- Import CSS from `EventModal.module.css` for inline input styling

### 5. `src/store/contactStore.ts`
No changes needed — `addPendingChange`, `updateContact` already exist.

## Address book picker UX

In `ContactList.tsx` (or ContactsView.tsx), the "+ New" button in `<div className={styles.metaBar}>`:
- If 1 visible address book → `onNew()` directly
- If >1 visible address books → show a small dropdown below the button listing address book names, click one → `onNew(addressBookId)`

Implemented as an absolutely-positioned `<div>` with address book names, toggled by the "+ New" button click.

## Execution order

```
Step 1: ContactFormFields.tsx (NEW) + ContactFormModal.tsx (NEW) — parallel
Step 2: ContactsView.tsx — add state + render modal
Step 3: ContactDetail.tsx — wire buttons + inline edit
Step 4: typecheck + test
```
