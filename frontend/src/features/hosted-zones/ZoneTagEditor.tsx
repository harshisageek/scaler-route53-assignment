'use client';

import TagEditor, { type TagEditorProps } from '@cloudscape-design/components/tag-editor';
import type { HostedZoneTag } from '@/lib/api/types';

export type EditableTag = TagEditorProps.Tag;

const I18N: TagEditorProps.I18nStrings = {
  keyPlaceholder: 'Enter key',
  valuePlaceholder: 'Enter value',
  addButton: 'Add new tag',
  removeButton: 'Remove',
  undoButton: 'Undo',
  undoPrompt: 'This tag will be removed when you save.',
  loading: 'Loading tags',
  keyHeader: 'Key',
  valueHeader: 'Value',
  optional: 'optional',
  keySuggestion: 'Tag key',
  valueSuggestion: 'Tag value',
  tooManyKeysSuggestion: 'You have too many keys to show',
  tooManyValuesSuggestion: 'You have too many values to show',
  emptyTags: 'No tags associated with this hosted zone.',
  errorIconAriaLabel: 'Error',
  emptyKeyError: 'Enter a tag key.',
  maxKeyCharLengthError: 'The tag key cannot exceed 128 characters.',
  maxValueCharLengthError: 'The tag value cannot exceed 256 characters.',
  duplicateKeyError: 'Each tag key must be unique.',
  invalidKeyError: 'The tag key contains invalid characters.',
  invalidValueError: 'The tag value contains invalid characters.',
  awsPrefixError: 'Tag keys cannot start with the reserved aws: prefix.',
  clearAriaLabel: 'Clear',
  tagLimit: (availableTags, tagLimit) => `${availableTags} of ${tagLimit} tags available`,
  tagLimitReached: (tagLimit) => `You have reached the limit of ${tagLimit} tags.`,
  tagLimitExceeded: (tagLimit) => `Remove tags until there are ${tagLimit} or fewer.`,
  enteredKeyLabel: (text) => `Use tag key: ${text}`,
  enteredValueLabel: (text) => `Use tag value: ${text}`,
  removeButtonAriaLabel: (tag) => `Remove tag ${tag.key}`,
};

export function editableTags(tags: HostedZoneTag[], existing = false): EditableTag[] {
  return tags.map((tag) => ({ ...tag, existing }));
}

export function tagsForRequest(tags: EditableTag[]): HostedZoneTag[] {
  return tags
    .filter((tag) => !tag.markedForRemoval)
    .map(({ key, value }) => ({ key: key.trim(), value: value.trim() }));
}

export function ZoneTagEditor({
  tags,
  onChange,
}: {
  tags: EditableTag[];
  onChange: (tags: EditableTag[], valid: boolean) => void;
}) {
  return (
    <TagEditor
      tags={tags}
      tagLimit={50}
      i18nStrings={I18N}
      onChange={({ detail }) => onChange([...detail.tags], detail.valid)}
    />
  );
}
