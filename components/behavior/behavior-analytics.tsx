'use client'

import { Card } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, AlertTriangle, Eye } from 'lucide-react'

export function BehaviorAnalytics() {
  // Empty data arrays - to be populated by admin with real data
  const behaviorData: any[] = []
  const timelineData: any[] = []
  const locationData: any[] = []

  const totalIncidents = behaviorData.reduce((sum, item) => sum + item.value, 0)
  const highSeverityCount = behaviorData
    .slice(0, 4)
    .reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Incidents</p>
              <p className="text-3xl font-bold text-white mt-1">{totalIncidents}</p>
              <p className="text-xs text-gray-500 mt-2">Last 24 hours</p>
            </div>
            <Eye className="w-8 h-8 text-blue-400 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-900/20 to-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-red-400 text-sm">High Severity</p>
              <p className="text-3xl font-bold text-red-300 mt-1">{highSeverityCount}</p>
              <p className="text-xs text-gray-500 mt-2">
                {Math.round((highSeverityCount / totalIncidents) * 100)}% of total
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-900/20 to-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-orange-400 text-sm">Peak Hour</p>
              <p className="text-3xl font-bold text-orange-300 mt-1">13:00</p>
              <p className="text-xs text-gray-500 mt-2">22 incidents detected</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Behavior Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 bg-slate-900">
          <h3 className="text-lg font-semibold text-white mb-4">Behavior Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={behaviorData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {behaviorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Timeline Chart */}
        <Card className="p-4 bg-slate-900">
          <h3 className="text-lg font-semibold text-white mb-4">Incident Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="time" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #444' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="incidents"
                stroke="#ff6b6b"
                strokeWidth={2}
                dot={{ fill: '#ff6b6b' }}
              />
              <Line
                type="monotone"
                dataKey="alerts"
                stroke="#ffa500"
                strokeWidth={2}
                dot={{ fill: '#ffa500' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Locations and Behavior Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Locations */}
        <Card className="p-4 bg-slate-900">
          <h3 className="text-lg font-semibold text-white mb-4">Top Locations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={locationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#888" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #444' }}
              />
              <Bar dataKey="incidents" fill="#ff6b6b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Behavior Type Comparison */}
        <Card className="p-4 bg-slate-900">
          <h3 className="text-lg font-semibold text-white mb-4">Behavior Type Breakdown</h3>
          <div className="space-y-3">
            {behaviorData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-sm text-gray-300">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${(item.value / totalIncidents) * 100}%`,
                        backgroundColor: item.fill,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-white w-8 text-right">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
