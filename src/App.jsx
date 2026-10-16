import { useCallback, useEffect, useMemo, useState } from 'react'
import { employeeApi, lookupApi, errorMessage } from './api'

const emptyForm = {
  fullName: '', email: '', phoneNumber: '', departmentId: '',
  designationId: '', dateOfJoining: '', salary: '', employmentStatus: 'ACTIVE'
}

function normalizePage(data) {
  if (Array.isArray(data)) return { content: data, totalElements: data.length, totalPages: 1, number: 0, size: data.length || 10 }
  return {
    content: data?.content || [],
    totalElements: data?.totalElements ?? data?.content?.length ?? 0,
    totalPages: data?.totalPages ?? 1,
    number: data?.number ?? 0,
    size: data?.size ?? 10
  }
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }) : '—'
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'EM'
}

function App() {
  const [employees, setEmployees] = useState([])
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 1, number: 0, size: 10 })
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [keyword, setKeyword] = useState('')
  const [searchText, setSearchText] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [lookupsLoading, setLookupsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [activeNav, setActiveNav] = useState('employees')

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true)
    const [deptResult, desResult] = await Promise.allSettled([
      lookupApi.departments(), lookupApi.designations()
    ])
    if (deptResult.status === 'fulfilled') {
      const data = deptResult.value.data
      setDepartments(Array.isArray(data) ? data : data?.content || [])
    } else {
      setError(`Could not load departments: ${errorMessage(deptResult.reason)}`)
    }
    if (desResult.status === 'fulfilled') {
      const data = desResult.value.data
      setDesignations(Array.isArray(data) ? data : data?.content || [])
    } else {
      setDesignations([])
    }
    setLookupsLoading(false)
  }, [])

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, size: pageSize, sort: 'employeeId,asc' }
      let response
      if (keyword.trim()) response = await employeeApi.search(keyword.trim(), params)
      else if (departmentFilter) response = await employeeApi.byDepartment(departmentFilter, params)
      else if (statusFilter) response = await employeeApi.byStatus(statusFilter, params)
      else response = await employeeApi.list(params)
      const normalized = normalizePage(response.data)
      setEmployees(normalized.content)
      setPageInfo(normalized)
    } catch (err) {
      setEmployees([])
      setPageInfo({ totalElements: 0, totalPages: 1, number: page, size: pageSize })
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [keyword, departmentFilter, statusFilter, page, pageSize])

  useEffect(() => { loadLookups() }, [loadLookups])
  useEffect(() => { loadEmployees() }, [loadEmployees])

  const activeCount = useMemo(() => employees.filter(e => e.employmentStatus === 'ACTIVE').length, [employees])
  const inactiveCount = useMemo(() => employees.filter(e => e.employmentStatus === 'INACTIVE').length, [employees])

  function runSearch(event) {
    event?.preventDefault()
    setPage(0)
    setKeyword(searchText)
  }

  function resetFilters() {
    setSearchText('')
    setKeyword('')
    setDepartmentFilter('')
    setStatusFilter('')
    setPage(0)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  async function openEdit(employee) {
    setFormError('')
    setEditingId(employee.employeeId)
    setForm({
      fullName: employee.fullName || '',
      email: employee.email || '',
      phoneNumber: employee.phoneNumber || '',
      departmentId: employee.departmentId ?? '',
      designationId: employee.designationId ?? '',
      dateOfJoining: employee.dateOfJoining || '',
      salary: employee.salary ?? '',
      employmentStatus: employee.employmentStatus || 'ACTIVE'
    })
    setModalOpen(true)
  }

  function changeForm(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  async function submitEmployee(event) {
    event.preventDefault()
    setFormError('')
    const salary = Number(form.salary)
    if (!form.fullName.trim()) return setFormError('Full name is required.')
    if (!form.email.trim()) return setFormError('Email is required.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setFormError('Enter a valid email address.')
    if (!form.departmentId || !form.designationId) return setFormError('Select both a department and designation.')
    if (!form.dateOfJoining) return setFormError('Date of joining is required.')
    if (!Number.isFinite(salary) || salary < 0) return setFormError('Salary must be zero or greater.')
    const body = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      departmentId: Number(form.departmentId),
      designationId: Number(form.designationId),
      dateOfJoining: form.dateOfJoining,
      salary,
      employmentStatus: form.employmentStatus
    }
    setSaving(true)
    try {
      if (editingId != null) {
        await employeeApi.update(editingId, body)
        setNotice('Employee details updated successfully.')
      } else {
        await employeeApi.create(body)
        setNotice('Employee created successfully.')
      }
      setModalOpen(false)
      setPage(0)
      await loadEmployees()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteEmployee(employee) {
    const confirmed = window.confirm(`Delete ${employee.fullName}? This action cannot be undone.`)
    if (!confirmed) return
    setDeletingId(employee.employeeId)
    setNotice('')
    try {
      await employeeApi.remove(employee.employeeId)
      setNotice(`${employee.fullName} was deleted.`)
      if (employees.length === 1 && page > 0) setPage(current => current - 1)
      else await loadEmployees()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  function departmentName(employee) {
    return employee.departmentName || departments.find(d => Number(d.departmentId) === Number(employee.departmentId))?.departmentName || '—'
  }
  function designationName(employee) {
    return employee.designationName || designations.find(d => Number(d.designationId) === Number(employee.designationId))?.designationName || '—'
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><i className="bi bi-people-fill" /></div>
          <div><div className="brand-name">PeopleDesk</div><div className="brand-caption">PEOPLE OPERATIONS</div></div>
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <button className={`side-link ${activeNav === 'overview' ? 'active' : ''}`} onClick={() => setActiveNav('overview')}>
          <i className="bi bi-grid-1x2" /><span>Overview</span>
        </button>
        <button className={`side-link ${activeNav === 'employees' ? 'active' : ''}`} onClick={() => setActiveNav('employees')}>
          <i className="bi bi-person-vcard" /><span>Employees</span><span className="nav-count">{pageInfo.totalElements}</span>
        </button>
        <div className="sidebar-bottom">
          <div className="connection-dot" />
          <div><div className="connection-title">Backend connection</div><div className="connection-subtitle">localhost:8081</div></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><i className="bi bi-chevron-right" /><strong>{activeNav === 'overview' ? 'Overview' : 'Employees'}</strong></div>
          <div className="topbar-right"><span className="environment-pill"><span /> Local environment</span><div className="avatar-small">AD</div></div>
        </header>

        <div className="content-area">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PEOPLE DIRECTORY</div>
              <h1>{activeNav === 'overview' ? 'Team overview' : 'Employee management'}</h1>
              <p>Manage your people, roles, and employee information in one place.</p>
            </div>
            <button className="btn btn-primary create-button" onClick={openCreate}><i className="bi bi-plus-lg me-2" />Add employee</button>
          </div>

          <section className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Total employees</span><span className="stat-icon indigo"><i className="bi bi-people" /></span></div><div className="stat-value">{pageInfo.totalElements}</div><div className="stat-foot">Matching current view</div></div>
            <div className="stat-card"><div className="stat-top"><span>Active on this page</span><span className="stat-icon green"><i className="bi bi-person-check" /></span></div><div className="stat-value">{activeCount}</div><div className="stat-foot">Currently active employees</div></div>
            <div className="stat-card"><div className="stat-top"><span>Inactive on this page</span><span className="stat-icon amber"><i className="bi bi-person-dash" /></span></div><div className="stat-value">{inactiveCount}</div><div className="stat-foot">Inactive employees</div></div>
            <div className="stat-card"><div className="stat-top"><span>Departments</span><span className="stat-icon blue"><i className="bi bi-diagram-3" /></span></div><div className="stat-value">{departments.length}</div><div className="stat-foot">Available departments</div></div>
          </section>

          {notice && <div className="alert alert-success alert-dismissible d-flex align-items-center" role="alert"><i className="bi bi-check-circle me-2" />{notice}<button className="btn-close ms-auto" onClick={() => setNotice('')} aria-label="Close" /></div>}
          {error && <div className="alert alert-danger alert-dismissible" role="alert"><strong>Connection or request error:</strong> {error}<button className="btn-close ms-2" onClick={() => setError('')} aria-label="Close" /></div>}

          <section className="directory-card">
            <div className="directory-header">
              <div><h2>All employees</h2><p>Search, filter, and manage employee records.</p></div>
              <span className="record-count"><span className="record-dot" /> {pageInfo.totalElements} records</span>
            </div>
            <div className="filters-row">
              <form className="search-box" onSubmit={runSearch}>
                <i className="bi bi-search" />
                <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search name or email..." aria-label="Search name or email" />
                <button type="submit" className="search-submit">Search</button>
              </form>
              <select className="form-select filter-select" value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setStatusFilter(''); setKeyword(''); setSearchText(''); setPage(0) }} aria-label="Filter by department">
                <option value="">All departments</option>
                {departments.map(d => <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>)}
              </select>
              <select className="form-select filter-select status-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setDepartmentFilter(''); setKeyword(''); setSearchText(''); setPage(0) }} aria-label="Filter by status">
                <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
              </select>
              {(keyword || departmentFilter || statusFilter) && <button className="btn btn-light clear-button" onClick={resetFilters}><i className="bi bi-x-lg me-1" />Clear</button>}
            </div>

            <div className="table-responsive employee-table-wrap">
              <table className="table employee-table align-middle">
                <thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>DESIGNATION</th><th>JOINED ON</th><th>SALARY</th><th>STATUS</th><th className="text-end">ACTIONS</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan="7"><div className="loading-state"><span className="spinner-border spinner-border-sm me-2" />Loading employees...</div></td></tr>
                    : employees.length === 0 ? <tr><td colSpan="7"><div className="empty-state"><div className="empty-icon"><i className="bi bi-person-lines-fill" /></div><h3>No employees found</h3><p>Try changing your search or add a new employee.</p><button className="btn btn-primary btn-sm" onClick={openCreate}>Add employee</button></div></td></tr>
                    : employees.map(employee => <tr key={employee.employeeId}>
                      <td><div className="employee-cell"><div className="employee-avatar">{initials(employee.fullName)}</div><div><div className="employee-name">{employee.fullName}</div><div className="employee-email">{employee.email}</div><div className="employee-id">ID #{employee.employeeId}</div></div></div></td>
                      <td><span className="department-label">{departmentName(employee)}</span></td>
                      <td className="designation-cell">{designationName(employee)}</td>
                      <td className="date-cell">{employee.dateOfJoining || '—'}</td>
                      <td className="salary-cell">{money(employee.salary)}</td>
                      <td><span className={`status-pill ${employee.employmentStatus === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}><span />{employee.employmentStatus || 'UNKNOWN'}</span></td>
                      <td><div className="actions-cell"><button title="Edit employee" aria-label={`Edit ${employee.fullName}`} className="icon-button" onClick={() => openEdit(employee)}><i className="bi bi-pencil" /></button><button title="Delete employee" aria-label={`Delete ${employee.fullName}`} className="icon-button danger-action" disabled={deletingId === employee.employeeId} onClick={() => deleteEmployee(employee)}>{deletingId === employee.employeeId ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-trash3" />}</button></div></td>
                    </tr>)}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div className="showing-text">Showing <strong>{employees.length ? page * pageSize + 1 : 0}–{page * pageSize + employees.length}</strong> of <strong>{pageInfo.totalElements}</strong> employees</div>
              <div className="pagination-controls">
                <label htmlFor="page-size">Rows</label><select id="page-size" className="form-select page-size-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>
                <button className="page-button" disabled={page <= 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))} aria-label="Previous page"><i className="bi bi-chevron-left" /></button>
                <span className="page-number">{page + 1} <span>of</span> {Math.max(pageInfo.totalPages, 1)}</span>
                <button className="page-button" disabled={page + 1 >= pageInfo.totalPages || loading} onClick={() => setPage(p => p + 1)} aria-label="Next page"><i className="bi bi-chevron-right" /></button>
              </div>
            </div>
          </section>
          <footer className="page-footer"><span>PeopleDesk <span className="footer-separator">·</span> Employee Management System</span><span><i className="bi bi-shield-check me-1" />Connected to your Spring Boot API</span></footer>
        </div>
      </main>

      {modalOpen && <div className="modal-backdrop-custom" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModalOpen(false) }}>
        <div className="employee-modal" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title">
          <div className="modal-heading"><div><div className="eyebrow">{editingId != null ? 'EMPLOYEE RECORD' : 'NEW RECORD'}</div><h2 id="employee-modal-title">{editingId != null ? 'Edit employee' : 'Add employee'}</h2><p>{editingId != null ? 'Update the details below.' : 'Enter the employee details to create a record.'}</p></div><button className="modal-close" onClick={() => !saving && setModalOpen(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></div>
          {formError && <div className="alert alert-danger py-2">{formError}{!designations.length && <div className="small mt-1">Designation list could not be loaded. Check that GET /designations exists on the backend.</div>}</div>}
          <form onSubmit={submitEmployee}>
            <div className="form-section-title">PERSONAL INFORMATION</div>
            <div className="form-grid">
              <div className="field-group span-2"><label htmlFor="fullName">Full name <span>*</span></label><input id="fullName" name="fullName" className="form-control" value={form.fullName} onChange={changeForm} placeholder="e.g. Rahul Sharma" required /></div>
              <div className="field-group"><label htmlFor="email">Email address <span>*</span></label><input id="email" name="email" type="email" className="form-control" value={form.email} onChange={changeForm} placeholder="name@company.com" required /></div>
              <div className="field-group"><label htmlFor="phoneNumber">Phone number</label><input id="phoneNumber" name="phoneNumber" className="form-control" value={form.phoneNumber} onChange={changeForm} placeholder="e.g. 9876543210" /></div>
            </div>
            <div className="form-section-title mt-4">ROLE & EMPLOYMENT</div>
            <div className="form-grid">
              <div className="field-group"><label htmlFor="departmentId">Department <span>*</span></label><select id="departmentId" name="departmentId" className="form-select" value={form.departmentId} onChange={changeForm} required><option value="">{lookupsLoading ? 'Loading departments...' : 'Select department'}</option>{departments.map(d => <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>)}</select></div>
              <div className="field-group"><label htmlFor="designationId">Designation <span>*</span></label><select id="designationId" name="designationId" className="form-select" value={form.designationId} onChange={changeForm} required><option value="">{lookupsLoading ? 'Loading designations...' : 'Select designation'}</option>{designations.map(d => <option key={d.designationId} value={d.designationId}>{d.designationName}</option>)}</select></div>
              <div className="field-group"><label htmlFor="dateOfJoining">Date of joining <span>*</span></label><input id="dateOfJoining" name="dateOfJoining" type="date" className="form-control" value={form.dateOfJoining} onChange={changeForm} max={new Date().toISOString().slice(0, 10)} required /></div>
              <div className="field-group"><label htmlFor="salary">Annual salary (₹) <span>*</span></label><input id="salary" name="salary" type="number" min="0" step="0.01" className="form-control" value={form.salary} onChange={changeForm} placeholder="e.g. 550000" required /></div>
              <div className="field-group span-2"><label htmlFor="employmentStatus">Employment status <span>*</span></label><select id="employmentStatus" name="employmentStatus" className="form-select" value={form.employmentStatus} onChange={changeForm}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-light cancel-button" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary save-button" disabled={saving || lookupsLoading || !departments.length || !designations.length}>{saving && <span className="spinner-border spinner-border-sm me-2" />}{editingId != null ? 'Save changes' : 'Create employee'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  )
}

export default App