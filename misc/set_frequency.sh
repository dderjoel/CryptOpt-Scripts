#!/usr/bin/env bash

# Note: https://wiki.archlinux.org/index.php/CPU_frequency_scaling#Disabling_Turbo_Boost

base=/sys/devices/system/cpu/

# 1 means ENABLE boost
boost_path_amd=${base}cpufreq/boost
# 0 means ENABLE boost
boost_path_intel=${base}intel_pstate/no_turbo

cur_read_string=/scaling_cur_freq

max_scaling_string=/scaling_max_freq
min_scaling_string=/scaling_min_freq

mapfile -t cores < <(seq 0 $(($(nproc --all) - 1)))
echo "${cores[@]}"

function amd {
  test -e ${boost_path_amd}
}

function read_cpu {
  printf "Currently: \tCPU   n    MIN   Hz -   MAX    Hz\t  CUR    Hz\tGOVENOR\n"

  for i in "${cores[@]}"; do
    printf "\t \tCPU %3d\t%9dHz - %9dHz\t%9dHz\t%s\n" "${i}" \
      "$(<"${base}cpu${i}/cpufreq${min_scaling_string}")" \
      "$(<"${base}cpu${i}/cpufreq${max_scaling_string}")" \
      "$(<"${base}cpu${i}/cpufreq${cur_read_string}")" \
      "$(<"${base}cpu${i}/cpufreq/scaling_governor")"
  done

  echo -e -n "Boost:\t"

  if amd; then
    [[ 0 == $(<${boost_path_amd}) ]] && echo 'AMD Boost disabled' || echo 'AMD Boost enabled'
  else
    [[ 1 == $(<${boost_path_intel}) ]] && echo ' Intel TB disabled' || echo ' Intel TB enabled'
  fi

}

function set_gov {
  if grep -q "${1}" ${base}cpu0/cpufreq/scaling_available_governors; then
    echo "${1}" | tee ${base}cpu*/cpufreq/scaling_governor && return
  fi
}

# for each core,
# - set gov to demand/powersave
# - set max freq to MAX possible
# - set min freq to MIN possible
# - enable boost
function default {

  enable_boost

  if amd; then
    set_gov ondemand
  else
    set_gov powersave
  fi

  # re-set freq to defaults on intels (amd's will ignore that anyway, because of gov ondemand)
  if ! amd; then

    for p in "${base}"cpu*/cpufreq; do
      read -r max <"${p}/cpuinfo_max_freq"
      echo "${max}" >"${p}${max_scaling_string}"

      read -r min <"${p}/cpuinfo_min_freq"
      echo "${min}" >"${p}${min_scaling_string}"
    done
  fi
}

# for each core,
# - disable boost
# - set gov to userspace/performance
# - set freq to $1 or base/lowest available
function fix {

  disable_boost

  if amd; then
    set_gov userspace
    for p in "${base}"cpu*/cpufreq; do
      # check if we got a freq, and if so, if it is available.
      if test -n "${1}" -a -r "${p}/scaling_available_frequencies" && grep -q "${1}" "${p}/scaling_available_frequencies"; then
        # if so, use it
        f="${1}"
        # otherwise, use the last (i.e. lowest) available (if there some check?)
      elif test -r "${p}/scaling_available_frequencies"; then
        f=$(awk '{ print $NF }' "${p}/scaling_available_frequencies")
      else
        f=$(<"${p}/cpuinfo_min_freq")
      fi
      # and write that to the sysfs
      echo "${f}" >"${p}/scaling_setspeed"
    done
  else
    #intel
    set_gov performance
    for p in "${base}"cpu*/cpufreq; do
      # check if we got a freq, and if so, use it
      if test -n "${1}"; then
        echo "using ${1}"
        f="${1}"
      else
        # otherwise, use the base freq
        f=$(awk '{ print $NF }' "${p}/base_frequency")
      fi
      # and write that to the sysfs (for min/max)
      echo "${f}" | tee "${p}${max_scaling_string}"
      echo "${f}" | tee "${p}${min_scaling_string}"
    done
  fi
}

function enable_boost {
  if amd; then
    echo 1 >${boost_path_amd}
  else
    echo 0 >${boost_path_intel}
  fi

}

function disable_boost {
  if amd; then
    echo 0 >${boost_path_amd}
  else
    echo 1 >${boost_path_intel}
  fi
}

function help_text() {
  echo "Usage: $0 fix | default | read"
  echo "sudo $0 'fix' [FREQ]   will DISABLE boost, set the govenor to PERFORMANCE/USERSPACE and set the FREQ to [FREQ]. FREQ defaults to base_frequency(Intel) or smallest available (AMD)."
  echo "sudo $0 'default'      will ENABLE  boost, set the govenor to POWERSAVE / ONDEMAND  and set the MIN/MAX_frequency to the MIN/MAX value."
  echo "     $0 'read'         prints out the current settings"
}

test ! -e ${base}cpu0/cpufreq${cur_read_string} && echo cannot read/write any frequencies. && exit 1

case ${1} in
"fix")
  #need super user privs to set freqs
  [[ $(id -u) != 0 ]] && echo -e "Must be run as root to set freqs" && exit 1
  fix "${2}"
  read_cpu
  exit 0
  ;;
"default")
  [[ $(id -u) != 0 ]] && echo -e "Must be run as root to set freqs" && exit 1
  default
  exit 0
  ;;
"read")
  read_cpu
  exit 0
  ;;
*)
  help_text
  exit 1
  ;;
esac
