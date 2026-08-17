# Phase D.1b Validation Checklist

## Build and type checks

- [ ] `@sammati/shared-core` builds
- [ ] `@sammati/webhook-utils` builds
- [ ] Type declarations emit successfully

## Tests

- [ ] Valid signature accepted
- [ ] Invalid signature rejected
- [ ] Tampered payload rejected
- [ ] Stale timestamp rejected
- [ ] Malformed header rejected
- [ ] Rotated secret accepted
- [ ] Constant-time compare path covered (length mismatch case)

## Contract compatibility

- [ ] Header parser supports `t=...,v1=...`
- [ ] Verification matches C.3 canonical signed string format
- [ ] Replay-window semantics documented and tested
- [ ] Framework-agnostic API surface preserved

## Non-goals enforced

- [ ] No server-sdk business APIs implemented
- [ ] No widget-sdk helper APIs implemented
- [ ] No framework adapter package added

