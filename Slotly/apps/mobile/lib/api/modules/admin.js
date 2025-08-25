// apps/mobile/lib/api/modules/admin.js - FIXED FOR AXIOS-BASED jsonFetch
import { jsonFetch } from "../modules/_fetch";

/**
 * Admin API client for mobile app
 * Handles business verification and admin operations
 */

export async function listPending(token, { page = 1, pageSize = 20, query = "" } = {}) {
  try {
    console.log('🔍 listPending called with:', { page, pageSize, query });
    
    const params = new URLSearchParams({
      status: "pending",
      page: String(page),
      pageSize: String(pageSize),
    });
    
    if (query?.trim()) {
      params.set("query", query.trim());
    }

    const url = `/api/admin/businesses?${params.toString()}`;
    console.log('📡 Making request to:', url);
    console.log('🔐 Using token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

    // jsonFetch returns data directly from Axios, not a fetch-like response object
    const data = await jsonFetch(url, {
      method: "GET",
      token,
    });

    console.log('📥 Data received:', {
      hasItems: !!data?.items,
      itemsCount: data?.items?.length || 0,
      hasPagination: !!data?.pagination,
      dataKeys: data ? Object.keys(data) : 'none'
    });

    console.log('✅ Success! Items count:', data?.items?.length || 0);
    return data; // { items: [...], pagination: {...}, filters: {...} }
    
  } catch (error) {
    console.error('💥 listPending error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      response: error.response?.data
    });
    throw error;
  }
}

export async function listBusinesses(token, { 
  page = 1, 
  pageSize = 20, 
  query = "", 
  status = "all",
  suspended = null 
} = {}) {
  try {
    console.log('🔍 listBusinesses called with:', { page, pageSize, query, status, suspended });
    
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    
    if (status && status !== "all") {
      params.set("status", status);
    }
    
    if (query?.trim()) {
      params.set("query", query.trim());
    }
    
    if (suspended !== null) {
      params.set("suspended", String(suspended));
    }

    const url = `/api/admin/businesses?${params.toString()}`;
    console.log('📡 Making request to:', url);

    const data = await jsonFetch(url, {
      method: "GET",
      token,
    });

    console.log('📥 Data received:', {
      hasItems: !!data?.items,
      itemsCount: data?.items?.length || 0
    });

    return data;
  } catch (error) {
    console.error('💥 listBusinesses error:', error);
    throw error;
  }
}

export async function getBusinessDetail(id, token) {
  if (!id) {
    throw new Error("Business ID is required");
  }

  try {
    console.log('🔍 getBusinessDetail called for ID:', id);
    
    const data = await jsonFetch(`/api/admin/businesses/${id}`, {
      method: "GET",
      token,
    });

    console.log('📥 Data received:', {
      hasId: !!data?.id,
      hasOwner: !!data?.owner,
      hasVerification: !!data?.verification
    });

    return data; // Full business details with owner, verification, attachments, etc.
  } catch (error) {
    console.error('💥 getBusinessDetail error:', error);
    throw error;
  }
}

export async function approveBusiness(id, token, { idempotencyKey } = {}) {
  if (!id) {
    throw new Error("Business ID is required");
  }

  try {
    console.log('🔍 approveBusiness called for ID:', id);

    const options = {
      method: "POST",
      token,
    };

    // Add idempotency key if provided
    if (idempotencyKey) {
      options.headers = {
        "Idempotency-Key": idempotencyKey,
      };
    }

    const data = await jsonFetch(`/api/admin/businesses/${id}/approve`, options);

    console.log('📥 Data received:', {
      hasMessage: !!data?.message,
      dataKeys: data ? Object.keys(data) : 'none'
    });

    return data; // { message, business: {...} }
  } catch (error) {
    console.error('💥 approveBusiness error:', error);
    throw error;
  }
}

export async function rejectBusiness(id, { purge = true, reason } = {}, token, { idempotencyKey } = {}) {
  if (!id) {
    throw new Error("Business ID is required");
  }

  try {
    console.log('🔍 rejectBusiness called for ID:', id);

    const options = {
      method: "POST",
      token,
      body: JSON.stringify({ purge, reason }),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add idempotency key if provided
    if (idempotencyKey) {
      options.headers["Idempotency-Key"] = idempotencyKey;
    }

    const data = await jsonFetch(`/api/admin/businesses/${id}/reject`, options);

    console.log('📥 Data received:', {
      hasMessage: !!data?.message,
      dataKeys: data ? Object.keys(data) : 'none'
    });

    return data; // { message, business: {...} }
  } catch (error) {
    console.error('💥 rejectBusiness error:', error);
    throw error;
  }
}

export async function updateBusiness(id, updates, token, { idempotencyKey } = {}) {
  if (!id) {
    throw new Error("Business ID is required");
  }

  const options = {
    method: "PATCH",
    token,
    body: JSON.stringify(updates),
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (idempotencyKey) {
    options.headers["Idempotency-Key"] = idempotencyKey;
  }

  const data = await jsonFetch(`/api/admin/businesses/${id}`, options);
  return data; // { message, business: {...} }
}

export async function deleteBusiness(id, token, { hard = false, idempotencyKey } = {}) {
  if (!id) {
    throw new Error("Business ID is required");
  }

  const params = hard ? "?hard=true" : "";
  
  const options = {
    method: "DELETE",
    token,
  };

  if (idempotencyKey) {
    options.headers = {
      "Idempotency-Key": idempotencyKey,
    };
  }

  const data = await jsonFetch(`/api/admin/businesses/${id}${params}`, options);
  return data; // { message, type: "soft_delete" | "hard_delete" }
}

// Utility function to get verification stats
export async function getVerificationStats(token) {
  const [pending, approved, rejected] = await Promise.all([
    listBusinesses(token, { status: "pending", pageSize: 1 }).then(r => r.pagination.total),
    listBusinesses(token, { status: "approved", pageSize: 1 }).then(r => r.pagination.total),
    listBusinesses(token, { status: "rejected", pageSize: 1 }).then(r => r.pagination.total),
  ]);

  return {
    pending,
    approved,
    rejected,
    total: pending + approved + rejected,
  };
}

// Utility function to bulk approve businesses
export async function bulkApproveBusinesses(businessIds, token, { idempotencyKey } = {}) {
  const results = [];
  const errors = [];

  for (const id of businessIds) {
    try {
      const result = await approveBusiness(id, token, { idempotencyKey });
      results.push({ id, success: true, result });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
      errors.push({ id, error: error.message });
    }
  }

  return {
    results,
    errors,
    successCount: results.filter(r => r.success).length,
    errorCount: errors.length,
  };
}

// Utility function to bulk reject businesses
export async function bulkRejectBusinesses(businessIds, { purge = true, reason } = {}, token, { idempotencyKey } = {}) {
  const results = [];
  const errors = [];

  for (const id of businessIds) {
    try {
      const result = await rejectBusiness(id, { purge, reason }, token, { idempotencyKey });
      results.push({ id, success: true, result });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
      errors.push({ id, error: error.message });
    }
  }

  return {
    results,
    errors,
    successCount: results.filter(r => r.success).length,
    errorCount: errors.length,
  };
}