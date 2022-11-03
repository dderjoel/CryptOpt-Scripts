# What is this?

[Ansible](https://ansible.com) playbooks.

There are a bunch of lab/remote machines and my personal dev-machine.
The dev machine has Ansible installed, where the lab machines all just run a plain up-to-date version of _Ubuntu Server 22.04.1 LTS_.

Ansible can be used to run all the experiments and evaluations on the machines controlled from the dev-machine.


## Okay, what do we find in here?

| Playbook | Description |
|-----|----
| `ensure-dependencies~` | Pretty much lists the Debian dependencies to run CryptOpt and the evaluations. |
| `pull-build~`          | Recursively pulls the repository and builds it. |
| `start-session~`       | A 'session' is an optimization run. Parameters are set, session script (tmux session) is created and the session runs in the background.  More info in `templates/session.mux.j2`| 
| `clean~`               | After a 'session' is completed, there are many result files. This mux-session will re-evaluate the most promising ones thoroughly and caches the results in a `.last_clean_run`-file in every result folder. More info in `templates/clean.mux.j2` and `../clean/`| 
| `update~`              | Pretty much an `sudo apt update && sudo apt upgrade -y`| 
| `wilson~`              | Pretty much a local loop through `curves` which are then "session'ed". |  
| `just-end-everything~` | Ends all Wilson's and CryptOpt's. |  
| `bench-supercop~`      | Mounts pil and runs the supercop benchmark. Will not pull supercop. |  

Key: (`~`: `.playbook.yaml` )





