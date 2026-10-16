# PeopleDesk — Employee Management Frontend
1Open the URL printed by Vite, normally `http://localhost:5173`.

## Backend API calls

- `GET /employees?page=0&size=10&sort=employeeId,asc`
- `GET /employees/search?keyword=...&page=0&size=10`
- `GET /employees/department/{departmentId}?page=0&size=10`
- `GET /employees/status/{status}?page=0&size=10`
- `GET /employees/{id}`
- `POST /employees`
- `PUT /employees/{id}`
- `DELETE /employees/{id}`
- `GET /departments`
- `GET /designations`

The frontend expects Spring Data's paginated response (`content`, `totalElements`, `totalPages`, `number`, `size`) for employee listing/search/filter endpoints. It also accepts a plain JSON array for lookup endpoints.

## Required backend lookup endpoint

The project already has `GET /departments`. The UI also expects `GET /designations`, returning an array such as:

```json
[
  { "designationId": 1, "designationName": "Software Developer" },
  { "designationId": 2, "designationName": "Senior Software Developer" }
]
```

Implement a small `DesignationLookupController` backed by `DesignationRepository` if this endpoint does not exist yet. Return only designation ID/name fields in a DTO, or return entities if they contain no unwanted relationships.


## Features

- Employee table with pagination
- Search by name/email
- Filter by department or employment status
- Create and edit employee forms
- Delete confirmation
- Department/designation dropdowns
- Loading, empty, and API error states

## Notes

- Keep the Spring Boot backend running while using the frontend.
- The employee create/update request expects `departmentId`, `designationId`, `dateOfJoining` (`YYYY-MM-DD`), `salary`, and `employmentStatus` (`ACTIVE` or `INACTIVE`).
- Never commit real database passwords or API secrets.
