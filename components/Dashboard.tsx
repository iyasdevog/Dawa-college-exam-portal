
import React from 'react';
import { StudentRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  students: StudentRecord[];
  onNavigateToManagement?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ students, onNavigateToManagement }) => {
  const totalStudents = students.length;
  const averageTotal = (students.reduce((acc, s) => acc + s.grandTotal, 0) / (totalStudents || 1)).toFixed(0);
  const passCount = students.filter(s => s.performanceLevel !== 'Failed').length;
  const passRate = ((passCount / (totalStudents || 1)) * 100).toFixed(1);

  const chartData = students.slice(0, 10).map(s => ({
    name: s.name.split(' ')[0],
    total: s.grandTotal
  })).sort((a, b) => b.total - a.total);

  const statusData = [
    { name: 'Passed', value: passCount, color: '#10b981' },
    { name: 'Failed', value: totalStudents - passCount, color: '#ef4444' }
  ];

  const stats = [
    { label: 'Total Students', value: totalStudents, icon: 'fa-users', color: 'bg-blue-500' },
    { label: 'Avg Grand Total', value: averageTotal, icon: 'fa-star', color: 'bg-amber-500' },
    { label: 'Overall Pass Rate', value: `${passRate}%`, icon: 'fa-check-circle', color: 'bg-emerald-500' },
    { label: 'Academic Session', value: '2025-26', icon: 'fa-calendar-alt', color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Management Quick Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Administrative Control</h3>
          <p className="text-sm text-slate-500">Configure academic subjects, faculty assignments, and student registries.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onNavigateToManagement}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <i className="fa-solid fa-sliders text-sm opacity-60"></i>
            Management Center
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className={`${stat.color} w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Top Performers Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Success Rate</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full space-y-3 mt-4">
            {statusData.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: s.color }}></div>
                  <span className="text-slate-600 font-medium">{s.name}</span>
                </div>
                <span className="font-bold text-slate-800">{s.value} Students</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
