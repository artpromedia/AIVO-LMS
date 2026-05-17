"use client";

export interface DistrictOverviewProps {
  district: { id: string; name: string };
  metrics: {
    schools: number;
    teachers: number;
    learners: number;
    activeRosterImportStatus?: "idle" | "running" | "completed" | "failed";
    lastImportAt?: string;
  };
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_STYLE: Record<string, string> = {
  idle: "bg-gray-200 text-gray-800",
  running: "bg-blue-200 text-blue-800",
  completed: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
};

export function DistrictOverview({ district, metrics }: DistrictOverviewProps) {
  const status = metrics.activeRosterImportStatus ?? "idle";
  return (
    <section className="district-overview rounded border p-4">
      <header>
        <h2 className="text-xl font-bold">{district.name}</h2>
        <p className="text-xs text-gray-600">{district.id}</p>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-gray-600">Schools</dt>
          <dd className="text-2xl font-semibold">{metrics.schools}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Teachers</dt>
          <dd className="text-2xl font-semibold">{metrics.teachers}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Learners</dt>
          <dd className="text-2xl font-semibold">{metrics.learners}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Roster import</dt>
          <dd>
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
            {metrics.lastImportAt ? (
              <span className="ml-2 text-xs text-gray-600">
                {new Date(metrics.lastImportAt).toLocaleString()}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default DistrictOverview;
