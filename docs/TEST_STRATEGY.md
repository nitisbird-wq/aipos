# Test Strategy

## Unit (Vitest)

- Readiness Gate A/B
- Handling Gate
- Mapping Gate + reject codes
- Idempotency duplicate detection
- Destination validation (reject `system: none`)
- Policy evaluation stubs

## Integration

- confirm → mission row + audit event
- Notion client mocked: success persists page id; failure sets sync_status=failed without success claim
- Transition command rejects illegal moves

## E2E (Playwright)

1. Submit intake → understanding visible  
2. Confirm → mission on dashboard  
3. Failed Notion mock → badge failed + no success toast  
4. Unresolved blocker → confirm rejected  
5. Viewport tests: 390px, 768px, 1280px  

## What not to test in v0.1

Specialist adapters, planning one_to_one execution, matching/assignment.
