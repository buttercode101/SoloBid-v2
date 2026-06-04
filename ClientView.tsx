export interface SharedProposalPayload {
  estimate: any;
  lineItems: any[];
  contractor: any;
}

function encodeUnicode(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeUnicode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeProposalPayload(payload: SharedProposalPayload) {
  return encodeUnicode(JSON.stringify(payload));
}

export function decodeProposalPayload(hash = window.location.hash): SharedProposalPayload | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const raw = params.get('data');
  if (!raw) return null;
  return JSON.parse(decodeUnicode(raw));
}

export function buildProposalUrl(id: string, payload: SharedProposalPayload) {
  const url = new URL(`/client/estimate/${id}`, window.location.origin);
  url.hash = `data=${encodeProposalPayload(payload)}`;
  return url.toString();
}

export function approvalCode(estimateId: string, signatureName: string) {
  const source = `${estimateId}:${signatureName}:${new Date().toISOString().slice(0, 10)}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return `SB-${Math.abs(hash).toString(36).toUpperCase().slice(0, 8)}`;
}
