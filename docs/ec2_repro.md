# EC2 reproducibility run (spec Amendment 1)

Instance from Yash's launcher: `ssh student@34.236.153.70` (password auth; 24 h TTL,
terminates 2026-09-20 16:20 UTC). The instance carries the `hackmit-2026-s3-readonly`
role, so the PUDL fetch needs no credentials.

From your Mac, in the repo root (the repo is private, so copy it rather than clone):

```bash
rsync -az --exclude node_modules --exclude data --exclude dist --exclude .git ./ student@34.236.153.70:~/wattson/
```

```bash
ssh -t student@34.236.153.70 'tmux new -A -s repro "cd ~/wattson && bash docs/ec2_repro.sh 2>&1 | tee docs/ec2_runtime.log; bash"'
```

Detach with `Ctrl-b d`; reattach with `ssh -t student@34.236.153.70 tmux attach -t repro`.
When it finishes, pull the numbers back:

```bash
scp student@34.236.153.70:~/wattson/docs/ec2_runtime.csv student@34.236.153.70:~/wattson/docs/ec2_runtime.log docs/
```

`docs/ec2_runtime.csv` has seconds per step and the total; the log ends with the
reproducibility check (committed vs regenerated detector ranks, PJM headline numbers).
Those two lines go in the Voloridge write-up.

Optional, so the run can be driven without typing the password again:
`ssh-copy-id student@34.236.153.70` once.
