function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isLeafNode(node) {
  return Boolean(node && node.id && !node.children && !node.layers);
}

function cloneFullSubtree(node) {
  if (!node) return node;
  if (isLeafNode(node)) return { ...node };

  return {
    ...node,
    layers: Array.isArray(node.layers) ? node.layers.map((layer) => ({ ...layer })) : undefined,
    children: Array.isArray(node.children) ? node.children.map(cloneFullSubtree) : undefined,
  };
}

function countLeafNodes(node) {
  if (!node) return 0;
  if (isLeafNode(node)) return 1;

  const layerCount = Array.isArray(node.layers) ? node.layers.length : 0;
  const childCount = Array.isArray(node.children)
    ? node.children.reduce((total, child) => total + countLeafNodes(child), 0)
    : 0;

  return layerCount + childCount;
}

function matchesQuery(node, normalizedQuery) {
  if (!normalizedQuery) return false;

  const haystack = [
    node?.name,
    node?.title,
    node?.id,
  ]
    .map(normalizeSearchText)
    .filter(Boolean);

  return haystack.some((value) => value.includes(normalizedQuery));
}

function filterNode(node, normalizedQuery) {
  if (!node) return null;

  if (!normalizedQuery) {
    return {
      node: cloneFullSubtree(node),
      matchCount: countLeafNodes(node),
    };
  }

  if (isLeafNode(node)) {
    if (matchesQuery(node, normalizedQuery)) {
      return { node: { ...node }, matchCount: 1 };
    }
    return null;
  }

  const groupMatches = matchesQuery(node, normalizedQuery);
  if (groupMatches) {
    return {
      node: cloneFullSubtree(node),
      matchCount: countLeafNodes(node),
    };
  }

  const filteredLayers = [];
  let layerMatchCount = 0;

  if (Array.isArray(node.layers)) {
    node.layers.forEach((layer) => {
      if (matchesQuery(layer, normalizedQuery)) {
        filteredLayers.push({ ...layer });
        layerMatchCount += 1;
      }
    });
  }

  const filteredChildren = [];
  let childMatchCount = 0;

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      const result = filterNode(child, normalizedQuery);
      if (!result) return;
      filteredChildren.push(result.node);
      childMatchCount += result.matchCount;
    });
  }

  if (!filteredLayers.length && !filteredChildren.length) {
    return null;
  }

  return {
    node: {
      ...node,
      layers: filteredLayers.length ? filteredLayers : undefined,
      children: filteredChildren.length ? filteredChildren : undefined,
    },
    matchCount: layerMatchCount + childMatchCount,
  };
}

export function filterTreeByQuery(tree = [], query = "") {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return {
      tree,
      matchCount: 0,
      hasQuery: false,
    };
  }

  const filteredTree = [];
  let matchCount = 0;

  tree.forEach((node) => {
    const result = filterNode(node, normalizedQuery);
    if (!result) return;
    filteredTree.push(result.node);
    matchCount += result.matchCount;
  });

  return {
    tree: filteredTree,
    matchCount,
    hasQuery: true,
  };
}

export { normalizeSearchText };
