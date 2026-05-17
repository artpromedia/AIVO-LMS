# DPA Management

District admins accept the data processing agreement (DPA) on behalf of
their district. Acceptance is per-version; superseding a previous DPA
requires a new acceptance record.

## Routes

```
POST /api/dpa/accept            -> record DPA acceptance
GET  /api/dpa/:districtId/latest -> latest acceptance for a district
```

## Record Shape

```ts
{
  id: string;
  districtId: string;
  version: string;
  acceptedById: string;
  acceptedByName: string;
  acceptedByRole: "district_admin" | string;
  acceptedAt: string;
}
```

## Compliance Report

The district compliance page surfaces:

- DPA status (latest accepted version + actor + timestamp)
- SIS import status
- audit event counts (`countByAction`)
- data export requests
- deletion requests
- role assignment summary
- profile recommendation approval counts
