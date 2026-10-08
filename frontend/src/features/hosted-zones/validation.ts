/**
 * Quick checks that run as the user types. The backend runs the full rules
 * (including international names) and its message wins if the two disagree.
 */

export const COMMENT_MAX_LENGTH = 256;
const NAME_MAX_LENGTH = 253;
const LABEL_MAX_LENGTH = 63;
const LABEL = /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/;
const VPC_ID = /^vpc-[0-9a-f]{8}(?:[0-9a-f]{9})?$/;

export function validateZoneName(raw: string): string | undefined {
  let name = raw.trim().toLowerCase();
  if (name.endsWith('.')) name = name.slice(0, -1);
  if (!name) return 'Enter a domain name.';
  // Non-ASCII names are converted to punycode by the server; leave them to it.
  if (!/^[\x00-\x7f]*$/.test(name)) return undefined;
  if (name.length > NAME_MAX_LENGTH)
    return `A domain name can have at most ${NAME_MAX_LENGTH} characters.`;

  const labels = name.split('.');
  if (labels.length < 2) return 'Enter a full domain name, such as example.com.';
  for (const label of labels) {
    if (!label) return "A domain name can't contain two dots in a row.";
    if (label.length > LABEL_MAX_LENGTH)
      return `Each part between dots can have at most ${LABEL_MAX_LENGTH} characters.`;
    if (!LABEL.test(label))
      return `"${label}" isn't valid. Use letters, digits, hyphens and underscores, and don't start or end a part with a hyphen.`;
  }
  if (/^\d+$/.test(labels.at(-1) ?? ''))
    return "The last part of a domain name can't be only digits.";
  return undefined;
}

export function validateComment(comment: string): string | undefined {
  return comment.length > COMMENT_MAX_LENGTH
    ? `The description can have up to ${COMMENT_MAX_LENGTH} characters.`
    : undefined;
}

export function validateVpcId(vpcId: string): string | undefined {
  if (!vpcId.trim()) return 'Enter a VPC ID.';
  return VPC_ID.test(vpcId.trim())
    ? undefined
    : 'A VPC ID looks like vpc-0a1b2c3d: "vpc-" and 8 or 17 lowercase hex characters.';
}
