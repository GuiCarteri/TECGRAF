# STRATA conservative adaptation

Based on @geoharkat/dlis-parser 1.0.4, MIT license retained.

- Keep EFLR and FDATA scopes separate by FILE-HEADER boundaries.
- Reject missing exact channel references instead of falling back to name matches or synthetic channels.
- Require explicit dimension and representation code; reject duplicate mnemonics inside a frame.
- Remove guessed waveform dimensions, FDATA frame-key reconciliation, and default/inferred run values.
- Preserve decoded arrays unchanged. Reject incomplete numerical frames.
- Reject encrypted records and malformed visible records rather than scanning forward for likely headers.
- RP66 padding count includes its terminal count byte.
- Only numeric representation codes supported by the current decoding path are accepted; unsupported forms fail explicitly.
- Metadata warnings remain visible. Vendor-specific metadata not recognized by the strict path may prevent plotting.

A full value-by-value comparison against dlisio passed for the documented Volve fixture. This is not certification of the parser or all producers' RP66 extensions.
