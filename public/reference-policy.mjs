export function curateReferences(references, policy) {
  const order = policy.featured || [];
  return references.filter(reference => !Object.hasOwn(policy.excluded || {}, reference.id)).map(reference => ({
    ...reference, name: policy.names?.[reference.id] || reference.name
  })).sort((a, b) => {
    const rank = id => order.includes(id) ? order.indexOf(id) : order.length;
    return rank(a.id) - rank(b.id);
  });
}
