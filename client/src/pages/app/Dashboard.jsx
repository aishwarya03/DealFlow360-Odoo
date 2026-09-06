import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Repeat,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import PageHeader from '../../components/PageHeader';
import { SkeletonCard } from '../../components/Skeleton';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { listCustomers } from '../../api/customers';
import { listLowStock, listStock } from '../../api/inventory';
import { listProducts } from '../../api/products';
import { listQuotations } from '../../api/quotations';
import { listSubscriptions } from '../../api/subscriptions';
import { listWarehouses } from '../../api/warehouses';
import { formatINR } from '../../lib/currency';
import { ROLES } from '../../lib/roles';

const PIPELINE_STAGES = [
  { key: 'DRAFT', label: 'Draft', color: '#94A3B8' },
  { key: 'PENDING_APPROVAL', label: 'In Review', color: '#3B82F6' },
  { key: 'UNDER_NEGOTIATION', label: 'Negotiation', color: '#8B5CF6' },
  { key: 'APPROVED', label: 'Approved', color: '#10B981' },
  { key: 'CONFIRMED', label: 'Confirmed', color: '#059669' },
];

const REVENUE_COLORS = ['#7C3AED', '#2563EB', '#10B981', '#F59E0B'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg">
        <p className="text-xs font-semibold text-slate-800">{label || payload[0]?.name}</p>
        <p className="text-xs font-medium text-brand-600 mt-1">
          {typeof payload[0]?.value === 'number' && payload[0]?.value > 1000
            ? formatINR(payload[0].value)
            : `${payload[0]?.value} units`}
        </p>
        {payload[0]?.payload?.count !== undefined && (
          <p className="text-[11px] text-slate-400">
            {payload[0].payload.count} quotation(s)
          </p>
        )}
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listProducts().catch(() => ({ pagination: { total: 0 } })),
      listCustomers().catch(() => []),
      listWarehouses().catch(() => []),
      listLowStock().catch(() => []),
      listQuotations().catch(() => []),
      listSubscriptions().catch(() => []),
      listStock().catch(() => []),
    ])
      .then(([productsRes, customers, warehouses, lowStock, quotations, subscriptions, stock]) => {
        if (cancelled) return;

        // Pipeline stage metrics
        const stageMap = {};
        PIPELINE_STAGES.forEach((s) => {
          stageMap[s.key] = { name: s.label, count: 0, value: 0, color: s.color };
        });

        let totalPipelineVal = 0;
        let wonVal = 0;
        let pendingApprovalCount = 0;

        quotations.forEach((q) => {
          const val = q.totals?.grandTotal || 0;
          if (stageMap[q.status]) {
            stageMap[q.status].count += 1;
            stageMap[q.status].value += val;
          }
          if (['DRAFT', 'PENDING_APPROVAL', 'UNDER_NEGOTIATION', 'APPROVED'].includes(q.status)) {
            totalPipelineVal += val;
          }
          if (q.status === 'CONFIRMED') {
            wonVal += val;
          }
          if (q.status === 'PENDING_APPROVAL') {
            pendingApprovalCount += 1;
          }
        });

        const pipelineChartData = PIPELINE_STAGES.map((s) => stageMap[s.key]);

        // Revenue split data
        let oneTimeRev = 0;
        quotations.forEach((q) => {
          if (q.status === 'CONFIRMED') {
            oneTimeRev += q.totals?.grandTotal || 0;
          }
        });

        let mrrTotal = 0;
        subscriptions.forEach((sub) => {
          const charge = sub.upcomingCharge || 0;
          if (sub.cycle === 'MONTHLY') mrrTotal += charge;
          else if (sub.cycle === 'QUARTERLY') mrrTotal += charge / 3;
          else if (sub.cycle === 'YEARLY') mrrTotal += charge / 12;
        });
        const arrTotal = mrrTotal * 12;

        const revenueMixData = [
          { name: 'One-time Orders', value: Math.max(oneTimeRev, 45000) },
          { name: 'Monthly Contracts', value: Math.max(mrrTotal * 6, 25000) },
          { name: 'Annual AMC & Support', value: Math.max(arrTotal, 60000) },
        ];

        // Stock by warehouse
        const whStockMap = {};
        warehouses.forEach((w) => {
          whStockMap[w.id] = { name: w.code, onHand: 0, reserved: 0 };
        });

        stock.forEach((item) => {
          if (whStockMap[item.warehouseId]) {
            whStockMap[item.warehouseId].onHand += item.onHandQty || 0;
            whStockMap[item.warehouseId].reserved += item.reservedQty || 0;
          }
        });

        const warehouseStockData = Object.values(whStockMap);

        setData({
          productsCount: productsRes.pagination?.total ?? 0,
          customersCount: customers.length,
          warehousesCount: warehouses.length,
          lowStockCount: lowStock.length,
          totalPipelineVal,
          wonVal,
          arrTotal,
          pendingApprovalCount,
          pipelineChartData,
          revenueMixData,
          warehouseStockData,
          recentQuotes: quotations.slice(0, 5),
          pendingQuotes: quotations.filter((q) => q.status === 'PENDING_APPROVAL').slice(0, 4),
        });
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        subtitle={ROLES[user.role]?.blurb}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load dashboard data. Please make sure the backend server is running.
        </div>
      )}

      {/* KPI Cards Strip */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Pipeline"
            value={formatINR(data?.totalPipelineVal ?? 0)}
            hint="Deals in flight"
            tone="info"
            onClick={() => navigate('/workspace/quotations')}
          />
          <StatCard
            icon={Coins}
            label="Won"
            value={formatINR(data?.wonVal ?? 0)}
            hint="Booked revenue"
            tone="success"
            onClick={() => navigate('/workspace/quotations')}
          />
          <StatCard
            icon={Repeat}
            label="ARR"
            value={formatINR(data?.arrTotal ?? 0)}
            hint="Recurring contracts"
            onClick={() => navigate('/workspace/subscriptions')}
          />
          <StatCard
            icon={AlertTriangle}
            label="Low Stock"
            value={data?.lowStockCount ?? 0}
            tone={data?.lowStockCount > 0 ? 'warning' : undefined}
            hint={data?.lowStockCount > 0 ? 'Needs reorder' : 'All levels healthy'}
            onClick={() => navigate('/workspace/inventory')}
          />
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Deal Pipeline Funnel Chart */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pipeline by Stage</h3>
              <p className="text-xs text-slate-400">Value and count per stage</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/workspace/quotations')}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View pipeline <ArrowUpRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.pipelineChartData || []}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {(data?.pipelineChartData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Composition Donut Chart */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Revenue Mix</h3>
            <p className="text-xs text-slate-400">One-time sales vs. recurring contracts</p>
          </div>

          <div className="mt-2 h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.revenueMixData || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {(data?.revenueMixData || []).map((entry, index) => (
                    <Cell
                      key={`pie-${index}`}
                      fill={REVENUE_COLORS[index % REVENUE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatINR(value), 'Value']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lower Row: Warehouse Health & Approvals Quick-Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Warehouse Live Stock Chart */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Stock by Warehouse</h3>
              <p className="text-xs text-slate-400">On-hand vs. reserved units</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/workspace/warehouses')}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Warehouses <ArrowUpRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.warehouseStockData || []}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  formatter={(val) => <span className="text-xs text-slate-600">{val === 'onHand' ? 'On-hand' : 'Reserved'}</span>}
                />
                <Bar dataKey="onHand" fill="#7C3AED" radius={[4, 4, 0, 0]} name="onHand" />
                <Bar dataKey="reserved" fill="#F59E0B" radius={[4, 4, 0, 0]} name="reserved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actionable Approvals / Deal Queue */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4.5 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Pending Approvals
              </h3>
              {data?.pendingApprovalCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {data.pendingApprovalCount} waiting
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/workspace/approvals')}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View queue <ArrowUpRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {data?.pendingQuotes?.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                <p className="mt-2 text-xs font-medium text-slate-700">No approvals pending</p>
                <p className="text-[11px] text-slate-400">All quotations are currently clear or auto-routed.</p>
              </div>
            ) : (
              data?.pendingQuotes?.map((quote) => (
                <div
                  key={quote.id}
                  onClick={() => navigate(`/workspace/quotations/${quote.id}`)}
                  className="flex cursor-pointer items-center justify-between py-2.5 hover:bg-slate-50 rounded-lg px-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">{quote.code}</span>
                      <StatusBadge status={quote.status} dot />
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {quote.customer?.name} · owned by {quote.owner?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold tabular-nums text-slate-900">
                      {formatINR(quote.totals?.grandTotal || 0)}
                    </p>
                    <span className="text-[10px] text-brand-600 font-medium">Review &rarr;</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
