/**
 * Parse page/pageSize from query params.
 * Default page=1, pageSize=20, max pageSize=100.
 */
function parsePagination(query) {
  let page = parseInt(query.page, 10) || 1;
  let pageSize = parseInt(query.pageSize, 10) || 20;
  if (page < 1) page = 1;
  if (pageSize < 1) pageSize = 1;
  if (pageSize > 100) pageSize = 100;
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

/**
 * Build a paginated response envelope.
 */
function paginatedResponse(data, total, page, pageSize) {
  return { data, total, page, pageSize };
}

module.exports = { parsePagination, paginatedResponse };

