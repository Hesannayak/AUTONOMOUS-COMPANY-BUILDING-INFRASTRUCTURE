"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface SwarmStatus {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface CompanyData {
  company_id: string;
  company_name: string;
  status: "pending" | "building" | "completed" | "failed";
  progress: number;
  swarms: SwarmStatus[];
  events: TimelineEvent[];
  budget: {
    total: number;
    spent: number;
    remaining: number;
  };
  created_at: string;
}

const SWARM_DEFAULTS: SwarmStatus[] = [
  { name: "Legal", status: "pending", progress: 0 },
  { name: "Product", status: "pending", progress: 0 },
  { name: "Growth", status: "pending", progress: 0 },
  { name: "Sales", status: "pending", progress: 0 },
  { name: "Finance", status: "pending", progress: 0 },
  { name: "Customer Success", status: "pending", progress: 0 },
];

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "running":
    case "building":
      return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
    case "failed":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "pending":
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getSwarmProgressColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500";
    case "running":
      return "bg-indigo-500";
    case "failed":
      return "bg-red-500";
    case "pending":
    default:
      return "bg-gray-600";
  }
}

function getEventDotColor(type: string): string {
  switch (type) {
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    case "info":
    default:
      return "bg-indigo-500";
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

export default function DashboardPage() {
  const params = useParams();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}`);
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Company not found"
            : `Failed to fetch company data (${response.status})`
        );
      }
      const data = await response.json();
      setCompany(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load company data"
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();

    const interval = setInterval(fetchCompany, 5000);
    return () => clearInterval(interval);
  }, [fetchCompany]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Loading company dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-400">Error</h2>
          <p className="mt-2 text-gray-400">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchCompany();
            }}
            className="mt-4 btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  const swarms = company.swarms?.length ? company.swarms : SWARM_DEFAULTS;
  const events = company.events || [];
  const budget = company.budget || { total: 0, spent: 0, remaining: 0 };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {company.company_name || "Untitled Company"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">ID: {company.company_id}</p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
              company.status
            )}`}
          >
            {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
          </span>
        </div>

        {/* Overall Progress */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Overall Progress</h2>
            <span className="text-2xl font-bold text-indigo-400">
              {company.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${company.progress}%` }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column: Swarms + Budget */}
          <div className="lg:col-span-2 space-y-8">
            {/* Swarm Status Cards */}
            <div>
              <h2 className="text-lg font-semibold mb-4">AI Swarm Status</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {swarms.map((swarm) => (
                  <div key={swarm.name} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{swarm.name}</h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                          swarm.status
                        )}`}
                      >
                        {swarm.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${getSwarmProgressColor(
                          swarm.status
                        )}`}
                        style={{ width: `${swarm.progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs text-gray-500">
                      {swarm.progress}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Tracker */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Budget Tracker</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400">Total Budget</div>
                  <div className="text-xl font-bold text-white">
                    ${budget.total.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Spent</div>
                  <div className="text-xl font-bold text-orange-400">
                    ${budget.spent.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Remaining</div>
                  <div className="text-xl font-bold text-emerald-400">
                    ${budget.remaining.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                {budget.total > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (budget.spent / budget.total) * 100,
                        100
                      )}%`,
                    }}
                  />
                )}
              </div>
              <div className="mt-1 text-right text-xs text-gray-500">
                {budget.total > 0
                  ? `${((budget.spent / budget.total) * 100).toFixed(1)}% used`
                  : "No budget data"}
              </div>
            </div>
          </div>

          {/* Right column: Event Timeline */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Event Timeline</h2>
            <div className="card max-h-[600px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  No events yet. Events will appear here as your company is
                  being built.
                </p>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1.5 ${getEventDotColor(
                            event.type
                          )}`}
                        />
                        <div className="w-px flex-1 bg-gray-800 mt-1" />
                      </div>
                      <div className="pb-4">
                        <p className="text-sm text-white">{event.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
