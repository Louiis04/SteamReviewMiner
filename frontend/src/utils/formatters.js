export const formatNumber = (value = 0) => new Intl.NumberFormat('pt-BR').format(value || 0);

export const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
