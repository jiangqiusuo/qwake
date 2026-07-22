# Qwake

Qwake is a local-first command line tool for making AI-provider workflows observable and repeatable. Its model fingerprinting context records statistical evidence about an endpoint's short-answer behavior; it does not establish cryptographic model identity.

## Model Fingerprinting

**Probe cell**:
A fixed task-language pair, such as `random-number-100:en`, whose answers form one categorical distribution.
_Avoid_: Question, prompt group

**Collection run**:
An immutable local record of samples collected from one endpoint under one declared measurement configuration.
_Avoid_: Scan, test result

**Reference profile**:
A named distributional baseline derived from a trusted collection run and used as the claimed behavior in later audits.
_Avoid_: Ground truth, official model proof

**Audit**:
A fresh collection run compared with a declared reference profile under compatible measurement conditions.
_Avoid_: Authentication, verification proof

**Behavioral drift**:
A reproducible difference between an audit profile and its reference profile that merits investigation but does not, on its own, identify a cause.
_Avoid_: Model substitution, fraud

**Verdict**:
A calibrated classification of comparison evidence: `likely_match`, `suspicious_drift`, `likely_mismatch`, or `inconclusive`.
_Avoid_: Identity determination, authenticity verdict
