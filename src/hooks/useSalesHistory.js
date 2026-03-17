import { useState, useCallback, useEffect } from "react";
import { salesHistoryApi } from "../api/salesHistory.js";
import { DEFAULT_PAGE_SIZE } from "../config/brand.js";

function normalizeListResponse(data) {
  if (data && typeof data === "object" && Array.isArray(data.items)) {
    return {
      list: data.items,
      totalCount: typeof data.totalCount === "number" ? data.totalCount : 0,
      totalPages: typeof data.totalPages === "number" ? data.totalPages : 0,
      page: typeof data.page === "number" ? data.page : 1,
      pageSize: typeof data.pageSize === "number" ? data.pageSize : DEFAULT_PAGE_SIZE,
    };
  }
  const list = Array.isArray(data) ? data : [];
  return { list, totalCount: list.length, totalPages: 1, page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

export function useSalesHistory(pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [sales, setSales] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await salesHistoryApi.list({ page, pageSize });
      const normalized = normalizeListResponse(data);
      setSales(normalized.list);
      setTotalCount(normalized.totalCount);
      setTotalPages(normalized.totalPages);
    } catch (e) {
      setError(e.message);
      setSales([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const cancel = useCallback(async (id) => {
    await salesHistoryApi.cancel(id);
    await fetchList();
  }, [fetchList]);

  const addPayment = useCallback(async (id, amount) => {
    await salesHistoryApi.addPayment(id, amount);
    await fetchList();
  }, [fetchList]);

  return { sales, loading, error, totalCount, totalPages, page, pageSize, setPage, refetch: fetchList, cancel, addPayment };
}
