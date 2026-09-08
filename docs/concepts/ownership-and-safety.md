# Ownership and safety

Farmall plans before it writes. The default ownership manifest is `.farmall-state.json`; change it with the top-level `state` field.

## Ownership manifest

Each managed entry records the destination path, pipeline, output name, plugin ID, source IDs, and a SHA-256 digest of the exact bytes. Ownership is pipeline-scoped:

- A pipeline updates and removes only its own entries.
- Running one pipeline preserves entries owned by other pipelines.
- A pipeline cannot take over another pipeline's destination.
- A different output plugin cannot take over a destination within the same pipeline.

Legacy entries without a `pipeline` field belong to `default`.

## Managed and create-only writes

`managed` is the default output policy. A managed output can be updated when the on-disk bytes still match its recorded digest. If a managed source disappears, Farmall deletes the stale output only when that digest still matches. A supplied desired mode is applied on creates and updates. Without one, creates use the operating system's safe file default and updates preserve the destination mode.

`create-only` writes a missing file but never claims it in the manifest. If the file exists with identical content, the action is a no-op. Different content is a conflict. The generated pull pipeline uses this policy so imported normalized files remain user-owned.

Farmall also reports a conflict when:

- A managed output targets an existing file with no ownership entry.
- A managed or stale output was edited after Farmall recorded it.
- Multiple desired outputs claim one path with different content or write policies.
- An output collides with the state manifest.

Identical claims can merge their output, plugin, and source ownership metadata.

## Path containment

Desired paths and manifest paths must be non-empty, relative paths without `..` segments. Farmall rejects symbolic links in both ancestor and leaf path components during planning, apply, and recovery. File reads use one no-follow file handle for bytes and mode, and verify that the opened file identity and metadata remain stable across the read. The plugin read helper also rejects paths outside the project root.

## Apply checks and recovery

Before the first write, the apply phase requires the ownership manifest captured by planning as a concurrency token, acquires an exclusive lock next to the manifest, then recovers any interrupted transaction and verifies every create, update, and delete action against the bytes and mode observed during planning. Lock metadata is fsynced before it is atomically published and records the PID, hostname, acquisition time, process start time, portable process-start identity when available, and a random nonce. A live or unverifiable owner blocks. Farmall recovers locks whose same-host process is provably dead or has a reused PID, plus malformed locks only after a conservative abandonment age. A separate recovery gate serializes stale-lock reapers. Release removes a lock only when its nonce and process identity still match the acquiring process.

A changed destination makes the complete plan stale, and no action is applied. Before mutating an output, Farmall atomically writes and fsyncs a durable journal containing every destination and manifest before/after state. Journal version 2 tags content as UTF-8 or base64 and records modes, so JSON never coerces typed arrays into numeric-key objects. Recovery still accepts valid version 1 text journals. Journal loading rejects malformed action states, non-canonical or duplicate destinations, reserved state paths, invalid modes, unexpected state paths, and invalid before/after manifests. The ownership manifest remains version 1 because it stores byte digests rather than file bodies. Desired byte arrays are cloned during planning so later caller mutation cannot change applied content or diverge from its recorded digest. Creates use atomic no-replace publication where the host filesystem supports hard links. Updates, deletes, rollback, and recovery revalidate expected bytes and mode immediately before mutation. Files are fsynced before publication; containing directories are fsynced on POSIX, while Windows retains file fsync and atomic replacement without attempting unsupported directory-handle fsync.

If application stops mid-transaction, the next apply acquires the lock and uses the journal to restore outputs and ownership state in reverse order. Recovery stops with a conflict if disk content matches neither recorded state. Farmall writes and fsyncs the ownership manifest last, marks the journal committed, then removes and directory-fsyncs the journal. Lock or journal cleanup failures after a successful commit are returned as typed warnings and do not misreport committed writes as failed. A failed mutation or recovery remains an apply error, and rollback failures are reported explicitly.

Farmall guarantees serialization between cooperating Farmall processes. Node does not expose portable descriptor-relative `openat` operations or rename/unlink compare-and-swap semantics equivalent to Linux `renameat2`, so repository-local non-Farmall writers can still race the final path operation and malicious processes can attempt symlink swaps. The repeated no-follow identity checks and no-replace creates narrow that window but do not claim to eliminate hostile filesystem TOCTOU.

`farmall check` and `farmall diff` run sources, transforms, outputs, lint, and planning but never call the apply phase. They do not write output files or the ownership manifest.
