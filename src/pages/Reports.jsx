import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  FileText, 
  Download, 
  Calendar, 
  User, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Upload, 
  Sparkles,
  Building,
  Palette,
  X,
  Lock
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URLS } from '../config';
import './Reports.css';

const API_REPORTS_URL = API_URLS.reports;
const API_SETTINGS_URL = API_URLS.settings;

const Reports = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Active Report Tab: 'employee' | 'company'
  const [activeTab, setActiveTab] = useState('employee');

  // Timeline state: preset '5' | '10' | '30' | 'custom'
  const [timelinePreset, setTimelinePreset] = useState('5');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 4 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Selected employee filter in employee report ('all' or employeeId)
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [usersList, setUsersList] = useState([]);

  // Data states
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // White-labelling settings state
  const [whiteLabel, setWhiteLabel] = useState({
    companyName: 'Charusat Tech Corp',
    logoUrl: '',
    brandColor: '#3b82f6',
    reportTitle: 'Executive Task & Performance Report',
    footerText: 'Confidential - For Internal Business Use Only',
    contactEmail: '24aiml024@charusat.edu.in'
  });
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user?.token}`,
  });

  const handleAuthError = () => {
    logout();
    navigate('/auth');
  };

  // Fetch White-label Settings
  const fetchWhiteLabel = async () => {
    try {
      const res = await fetch(`${API_SETTINGS_URL}/whitelabel`, { headers: getAuthHeaders() });
      if (res.status === 401) return handleAuthError();
      const data = await res.json();
      if (data.success && data.data) {
        setWhiteLabel(data.data);
      }
    } catch (err) {
      console.error('Failed to load branding settings:', err);
    }
  };

  // Fetch users for employee dropdown
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URLS.auth}/users`, { headers: getAuthHeaders() });
      if (res.status === 401) return handleAuthError();
      const data = await res.json();
      if (data.success) {
        setUsersList(data.data);
      }
    } catch (err) {
      console.error('Failed to load users list:', err);
    }
  };

  // Fetch Report Data based on active tab and timeline
  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = activeTab === 'employee' 
        ? `${API_REPORTS_URL}/employee` 
        : `${API_REPORTS_URL}/company`;

      let query = `?startDate=${startDate}&endDate=${endDate}`;
      if (activeTab === 'employee' && selectedEmployee !== 'all') {
        query += `&employeeId=${selectedEmployee}`;
      }

      const res = await fetch(`${endpoint}${query}`, { headers: getAuthHeaders() });
      if (res.status === 401) return handleAuthError();
      if (res.status === 403) {
        setError('Access denied: Admin privileges are required to view reports.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setReportData(data);
      } else {
        setError(data.message || 'Failed to generate report');
      }
    } catch {
      setError('Unable to fetch report data from server.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Preset Changes
  const handlePresetChange = (presetDays) => {
    setTimelinePreset(presetDays);
    const end = new Date();
    const start = new Date(Date.now() - (parseInt(presetDays, 10) - 1) * 86400000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchWhiteLabel();
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchReport();
    }
  }, [user, activeTab, startDate, endDate, selectedEmployee]);

  // Save White-label Settings
  const handleSaveBranding = async (e) => {
    e.preventDefault();
    try {
      setBrandingSaving(true);
      const res = await fetch(`${API_SETTINGS_URL}/whitelabel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(whiteLabel)
      });
      if (res.status === 401) return handleAuthError();
      const data = await res.json();
      if (data.success) {
        setWhiteLabel(data.data);
        setIsBrandingModalOpen(false);
        showToast('🎨 White-label branding updated successfully!');
      } else {
        alert(data.message || 'Failed to update branding settings');
      }
    } catch {
      alert('Error saving branding settings');
    } finally {
      setBrandingSaving(false);
    }
  };

  // Handle Logo Upload (Base64 conversion)
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setWhiteLabel({ ...whiteLabel, logoUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  // Generate PDF Report using jsPDF & autoTable
  const generatePDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const primaryColor = whiteLabel.brandColor || '#3b82f6';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper: Hex to RGB
    const hexToRgb = (hex) => {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [59, 130, 246];
    };
    const [r, g, b] = hexToRgb(primaryColor);

    // 1. Header Banner & Logo
    let currentY = 18;

    // Optional Logo
    if (whiteLabel.logoUrl && whiteLabel.logoUrl.startsWith('data:image')) {
      try {
        doc.addImage(whiteLabel.logoUrl, 'PNG', 14, 12, 24, 24);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(whiteLabel.companyName, 42, 22);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(whiteLabel.reportTitle, 42, 28);
        currentY = 40;
      } catch (e) {
        console.warn('Logo embed warning:', e);
      }
    } else {
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(whiteLabel.companyName, 14, currentY);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(whiteLabel.reportTitle, 14, currentY + 7);
      currentY += 16;
    }

    // Right-aligned report metadata
    const selectedEmpObj = selectedEmployee !== 'all' 
      ? usersList.find(u => (u.id || u._id) === selectedEmployee)
      : null;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Timeline: ${startDate} to ${endDate} (${timelinePreset} Days)`, pageWidth - 14, 20, { align: 'right' });
    const reportTypeLabel = activeTab === 'company' 
      ? 'Company Overview Report' 
      : selectedEmpObj 
        ? `Employee Report: ${selectedEmpObj.name}` 
        : 'Employee-wise Report (All Employees)';
    doc.text(`Report Type: ${reportTypeLabel}`, pageWidth - 14, 26, { align: 'right' });
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, pageWidth - 14, 32, { align: 'right' });

    // Decorative brand color bar
    doc.setFillColor(r, g, b);
    doc.rect(14, currentY, pageWidth - 28, 2, 'F');
    currentY += 10;

    // 2. Executive KPI Cards
    if (activeTab === 'company' && reportData?.summary) {
      const summary = reportData.summary;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Executive Summary', 14, currentY);
      currentY += 6;

      const kpis = [
        ['Total Tasks', `${summary.totalTasks}`],
        ['Completed', `${summary.completedTasks}`],
        ['In Progress', `${summary.inProgressTasks}`],
        ['Pending', `${summary.pendingTasks}`],
        ['Completion Rate', `${summary.companyCompletionRate}%`]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [kpis.map(k => k[0])],
        body: [kpis.map(k => k[1])],
        theme: 'grid',
        headStyles: { fillColor: [r, g, b], textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'center', fontStyle: 'bold', fontSize: 11 },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 12;

      // 3. Employee Workload Breakdown Table
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Employee Workload & Status Breakdown', 14, currentY);
      currentY += 6;

      const employeeRows = (reportData.employeeBreakdown || []).map(emp => [
        emp.employee.name,
        emp.employee.email,
        emp.tasksGiven,
        emp.completed,
        emp.inProgress,
        emp.pending,
        `${emp.completionRate}%`
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Employee', 'Email', 'Assigned', 'Done', 'In Progress', 'Pending', 'Rate']],
        body: employeeRows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 12;

      // 4. Detailed Task Audit
      if (reportData.tasks && reportData.tasks.length > 0) {
        if (currentY > pageHeight - 40) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Detailed Task Audit Log', 14, currentY);
        currentY += 6;

        const taskRows = reportData.tasks.map(t => [
          t.title,
          t.assignedTo?.name || 'Unassigned',
          (t.priority || 'medium').toUpperCase(),
          t.status.toUpperCase(),
          new Date(t.createdAt).toLocaleDateString(),
          t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Task Title', 'Assigned To', 'Priority', 'Status', 'Created', 'Due Date']],
          body: taskRows,
          theme: 'striped',
          headStyles: { fillColor: [r, g, b], textColor: 255 },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
      }
    } else if (activeTab === 'employee' && reportData?.data) {
      // Employee-wise PDF Generation
      reportData.data.forEach((empReport, index) => {
        if (index > 0) {
          doc.addPage();
          currentY = 20;
        }

        const { employee, summary, tasks } = empReport;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Employee: ${employee.name} (${employee.email})`, 14, currentY);
        currentY += 6;

        // KPI Summary
        const kpis = [
          ['Total Assigned', `${summary.total}`],
          ['Completed', `${summary.completed}`],
          ['In Progress', `${summary.inProgress}`],
          ['Pending', `${summary.pending}`],
          ['Completion Rate', `${summary.completionRate}%`]
        ];

        autoTable(doc, {
          startY: currentY,
          head: [kpis.map(k => k[0])],
          body: [kpis.map(k => k[1])],
          theme: 'grid',
          headStyles: { fillColor: [r, g, b], textColor: 255, halign: 'center' },
          bodyStyles: { halign: 'center', fontStyle: 'bold', fontSize: 10 },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        // Task Table
        const taskRows = tasks.map(t => [
          t.title,
          (t.priority || 'medium').toUpperCase(),
          t.status.toUpperCase(),
          new Date(t.createdAt).toLocaleDateString(),
          t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Task Title', 'Priority', 'Status', 'Assigned Date', 'Due Date']],
          body: taskRows.length > 0 ? taskRows : [['No tasks recorded in this timeline', '-', '-', '-', '-']],
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59], textColor: 255 },
          styles: { fontSize: 8.5 },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 14;
      });
    }

    // 5. Footer with White-label Disclaimer & Page Numbering
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);

      // Custom White-label footer
      doc.text(whiteLabel.footerText, 14, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }

    let filename;
    if (activeTab === 'company') {
      filename = `${whiteLabel.companyName.replace(/\s+/g, '_')}_Company_Report_${startDate}_${endDate}.pdf`;
    } else if (selectedEmpObj) {
      filename = `${whiteLabel.companyName.replace(/\s+/g, '_')}_${selectedEmpObj.name.replace(/\s+/g, '_')}_Report_${startDate}_${endDate}.pdf`;
    } else {
      filename = `${whiteLabel.companyName.replace(/\s+/g, '_')}_All_Employees_Report_${startDate}_${endDate}.pdf`;
    }

    doc.save(filename);
    showToast('📄 PDF report downloaded successfully!');
  };

  const selectedEmpObj = selectedEmployee !== 'all' 
    ? usersList.find(u => (u.id || u._id) === selectedEmployee)
    : null;

  if (!user || user.role !== 'admin') {
    return (
      <div className="reports-container">
        <div className="unauthorized-card">
          <Lock size={40} className="lock-icon" />
          <h2>Administrator Access Required</h2>
          <p>The Reports &amp; Analytics module is restricted to system administrators.</p>
          <button onClick={() => navigate('/tasks')} className="btn-return">Return to Kanban Board</button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`reports-toast toast-${toast.type}`}>
          <Sparkles className="toast-icon" size={16} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner with White-label Badge */}
      <div className="reports-header-banner" style={{ borderLeft: `6px solid ${whiteLabel.brandColor || '#3b82f6'}` }}>
        <div className="header-left">
          <div className="brand-identity-preview">
            {whiteLabel.logoUrl && (
              <img src={whiteLabel.logoUrl} alt="Logo" className="header-logo-img" />
            )}
            <div>
              <span className="brand-org-name">{whiteLabel.companyName}</span>
              <h1 className="reports-main-title">{whiteLabel.reportTitle}</h1>
            </div>
          </div>
          <p className="reports-subtitle">
            Comprehensive analytics, status tracking, and performance reports for your team.
          </p>
        </div>

        <div className="header-right-actions">
          <button 
            onClick={() => setIsBrandingModalOpen(true)}
            className="btn-branding-settings"
            title="Configure White Labelling (Logo, Colors, Organization Name)"
          >
            <Palette size={16} />
            <span>White-Label Branding</span>
          </button>

          <button 
            onClick={generatePDF}
            className="btn-download-pdf"
            disabled={loading || !reportData}
          >
            <Download size={16} />
            <span>{selectedEmpObj ? `Download PDF (${selectedEmpObj.name.split(' ')[0]})` : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Timeline, Report Types, and Employee Dropdown */}
      <div className="reports-controls-bar">
        {/* Report Type Selector */}
        <div className="report-type-tabs">
          <button
            className={`tab-btn ${activeTab === 'employee' ? 'active' : ''}`}
            onClick={() => setActiveTab('employee')}
          >
            <User size={16} />
            <span>Employee-wise Report</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            <Building size={16} />
            <span>Company-wide Report</span>
          </button>
        </div>

        {/* Employee Dropdown Filter (Visible on Employee Report Tab) */}
        {activeTab === 'employee' && (
          <div className="employee-filter-control">
            <span className="control-label">
              <Users size={15} /> Select Employee:
            </span>
            <div className="employee-select-wrapper">
              <select
                id="employee-report-select"
                className="employee-select-dropdown"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="all">👥 All Employees ({usersList.length})</option>
                {usersList.map((emp) => {
                  const empId = emp.id || emp._id;
                  return (
                    <option key={empId} value={empId}>
                      {emp.name} ({emp.email}){emp.role === 'admin' ? ' — Admin' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {/* Timeline Filter Controls */}
        <div className="timeline-controls-group">
          <span className="control-label"><Calendar size={14} /> Timeline:</span>
          <div className="preset-buttons">
            <button
              className={`preset-btn ${timelinePreset === '5' ? 'active' : ''}`}
              onClick={() => handlePresetChange('5')}
            >
              5 Days
            </button>
            <button
              className={`preset-btn ${timelinePreset === '10' ? 'active' : ''}`}
              onClick={() => handlePresetChange('10')}
            >
              10 Days
            </button>
            <button
              className={`preset-btn ${timelinePreset === '30' ? 'active' : ''}`}
              onClick={() => handlePresetChange('30')}
            >
              30 Days
            </button>
          </div>

          <div className="date-range-inputs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setTimelinePreset('custom');
              }}
              title="Start Date"
            />
            <span className="date-sep">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setTimelinePreset('custom');
              }}
              title="End Date"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="reports-loading">
          <div className="spinner"></div>
          <p>Analyzing task records and generating report...</p>
        </div>
      ) : error ? (
        <div className="reports-error">
          <AlertCircle size={28} />
          <p>{error}</p>
        </div>
      ) : (
        <div className="report-content-body">
          {/* TAB 1: EMPLOYEE-WISE REPORT */}
          {activeTab === 'employee' && reportData?.data && (
            <div className="employee-report-section">
              {/* Filter Active Indicator Banner */}
              {selectedEmployee !== 'all' && selectedEmpObj && (
                <div className="employee-filter-indicator">
                  <div className="filter-indicator-text">
                    <User size={16} />
                    <span>Showing report for: <strong>{selectedEmpObj.name}</strong> ({selectedEmpObj.email})</span>
                  </div>
                  <button 
                    onClick={() => setSelectedEmployee('all')} 
                    className="btn-clear-filter"
                    title="Show reports for all employees"
                  >
                    <X size={14} />
                    <span>View All Employees</span>
                  </button>
                </div>
              )}

              {reportData.data.length === 0 ? (
                <div className="empty-report-state">
                  <User size={48} className="empty-icon" />
                  <h3>No Employee Records Found</h3>
                  <p>No activity or tasks found for the selected employee within this timeline ({startDate} to {endDate}).</p>
                  <button onClick={() => setSelectedEmployee('all')} className="btn-clear-filter" style={{ marginTop: '1rem' }}>
                    View All Employees
                  </button>
                </div>
              ) : (
                reportData.data.map((empReport) => {
                  const { employee, summary, tasks } = empReport;
                  const empKey = employee.id || employee._id;

                  return (
                    <div key={empKey} className="employee-report-card">
                    {/* Employee Profile Header */}
                    <div className="emp-card-header">
                      <div className="emp-info">
                        <div className="emp-avatar">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3>{employee.name}</h3>
                          <span className="emp-email">{employee.email} &bull; {employee.role.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="emp-completion-badge">
                        <TrendingUp size={16} />
                        <span>{summary.completionRate}% Completion Rate</span>
                      </div>
                    </div>

                    {/* Summary KPI Strip */}
                    <div className="emp-kpi-grid">
                      <div className="emp-kpi-box">
                        <span className="kpi-num">{summary.total}</span>
                        <span className="kpi-label">Total Assigned</span>
                      </div>
                      <div className="emp-kpi-box status-done">
                        <span className="kpi-num">{summary.completed}</span>
                        <span className="kpi-label">Completed</span>
                      </div>
                      <div className="emp-kpi-box status-progress">
                        <span className="kpi-num">{summary.inProgress}</span>
                        <span className="kpi-label">In Progress</span>
                      </div>
                      <div className="emp-kpi-box status-pending">
                        <span className="kpi-num">{summary.pending}</span>
                        <span className="kpi-label">Pending</span>
                      </div>
                    </div>

                    {/* Task Breakdown Table */}
                    <div className="table-responsive">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Task Title</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Assigned / Created</th>
                            <th>Due Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="empty-row">No tasks assigned in this timeline.</td>
                            </tr>
                          ) : (
                            tasks.map(t => (
                              <tr key={t.id || t._id}>
                                <td className="task-title-cell">
                                  <strong>{t.title}</strong>
                                  {t.description && <small>{t.description}</small>}
                                </td>
                                <td>
                                  <span className={`priority-tag priority-${t.priority}`}>
                                    {t.priority?.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-tag status-${t.status}`}>
                                    {t.status === 'completed' && <Lock size={11} />}
                                    {t.status.toUpperCase()}
                                  </span>
                                </td>
                                <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                                <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          )}

          {/* TAB 2: COMPANY-WIDE REPORT */}
          {activeTab === 'company' && reportData?.summary && (
            <div className="company-report-section">
              {/* Executive Summary Cards */}
              <div className="company-kpi-strip">
                <div className="company-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <span className="kpi-big-num">{reportData.summary.totalTasks}</span>
                    <span className="kpi-big-label">Total Company Tasks</span>
                  </div>
                </div>

                <div className="company-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <span className="kpi-big-num">{reportData.summary.completedTasks}</span>
                    <span className="kpi-big-label">Completed Tasks</span>
                  </div>
                </div>

                <div className="company-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <span className="kpi-big-num">{reportData.summary.companyCompletionRate}%</span>
                    <span className="kpi-big-label">Overall Completion Rate</span>
                  </div>
                </div>

                <div className="company-kpi-card">
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <span className="kpi-big-num">{reportData.summary.priorityBreakdown?.high || 0}</span>
                    <span className="kpi-big-label">High Priority Tasks</span>
                  </div>
                </div>
              </div>

              {/* Employee Breakdown Table */}
              <div className="report-card-box">
                <div className="box-header">
                  <h2>Tasks Given Per Employee (Workload Distribution)</h2>
                  <span className="badge-timeline">{timelinePreset} Days Timeline</span>
                </div>
                <div className="table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Email</th>
                        <th>Tasks Given</th>
                        <th>Completed</th>
                        <th>In Progress</th>
                        <th>Pending</th>
                        <th>Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.employeeBreakdown || []).map(emp => (
                        <tr key={emp.employee.id}>
                          <td><strong>{emp.employee.name}</strong></td>
                          <td>{emp.employee.email}</td>
                          <td><span className="count-pill">{emp.tasksGiven}</span></td>
                          <td style={{ color: '#34d399', fontWeight: 'bold' }}>{emp.completed}</td>
                          <td style={{ color: '#60a5fa' }}>{emp.inProgress}</td>
                          <td style={{ color: '#fbbf24' }}>{emp.pending}</td>
                          <td>
                            <div className="rate-bar-wrap">
                              <div className="rate-bar" style={{ width: `${emp.completionRate}%`, background: whiteLabel.brandColor || '#3b82f6' }}></div>
                              <span>{emp.completionRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Tasks Audit */}
              <div className="report-card-box" style={{ marginTop: '2rem' }}>
                <div className="box-header">
                  <h2>All Tasks In Timeline</h2>
                  <span className="badge-counter">{reportData.tasks?.length || 0} Records</span>
                </div>
                <div className="table-responsive">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Task Title</th>
                        <th>Assigned To</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.tasks || []).map(t => (
                        <tr key={t.id || t._id}>
                          <td className="task-title-cell"><strong>{t.title}</strong></td>
                          <td>{t.assignedTo?.name || 'Unassigned'}</td>
                          <td><span className={`priority-tag priority-${t.priority}`}>{t.priority?.toUpperCase()}</span></td>
                          <td>
                            <span className={`status-tag status-${t.status}`}>
                              {t.status === 'completed' && <Lock size={11} />}
                              {t.status.toUpperCase()}
                            </span>
                          </td>
                          <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: White-Label Branding Settings */}
      {isBrandingModalOpen && (
        <div className="modal-backdrop">
          <div className="branding-modal">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Palette size={20} style={{ color: whiteLabel.brandColor || '#3b82f6' }} />
                <h2>White-Label Report Branding</h2>
              </div>
              <button onClick={() => setIsBrandingModalOpen(false)} className="btn-close-modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBranding} className="branding-form">
              <div className="form-group">
                <label>Company / Organization Name</label>
                <input
                  type="text"
                  required
                  value={whiteLabel.companyName}
                  onChange={(e) => setWhiteLabel({ ...whiteLabel, companyName: e.target.value })}
                  placeholder="e.g. Acme Corporation"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Brand Accent Color</label>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      value={whiteLabel.brandColor}
                      onChange={(e) => setWhiteLabel({ ...whiteLabel, brandColor: e.target.value })}
                    />
                    <input
                      type="text"
                      value={whiteLabel.brandColor}
                      onChange={(e) => setWhiteLabel({ ...whiteLabel, brandColor: e.target.value })}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={whiteLabel.contactEmail}
                    onChange={(e) => setWhiteLabel({ ...whiteLabel, contactEmail: e.target.value })}
                    placeholder="admin@company.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Company Logo</label>
                <div className="logo-upload-area">
                  {whiteLabel.logoUrl ? (
                    <div className="logo-preview-box">
                      <img src={whiteLabel.logoUrl} alt="Logo Preview" />
                      <button 
                        type="button" 
                        onClick={() => setWhiteLabel({ ...whiteLabel, logoUrl: '' })}
                        className="btn-remove-logo"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="upload-dropzone">
                      <Upload size={24} />
                      <span>Click to upload Company Logo (PNG, JPG, SVG)</span>
                      <small>Max 2MB</small>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Report Title</label>
                <input
                  type="text"
                  value={whiteLabel.reportTitle}
                  onChange={(e) => setWhiteLabel({ ...whiteLabel, reportTitle: e.target.value })}
                  placeholder="Executive Task & Performance Report"
                />
              </div>

              <div className="form-group">
                <label>Report Footer / Confidentiality Disclaimer</label>
                <input
                  type="text"
                  value={whiteLabel.footerText}
                  onChange={(e) => setWhiteLabel({ ...whiteLabel, footerText: e.target.value })}
                  placeholder="Confidential - For Internal Business Use Only"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setIsBrandingModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={brandingSaving}
                  className="btn-save-branding"
                  style={{ background: whiteLabel.brandColor || '#3b82f6' }}
                >
                  {brandingSaving ? 'Saving Branding...' : 'Save Branding Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
