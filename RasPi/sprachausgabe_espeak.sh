#!/bin/bash
say() { espeak "$*" --stdout |aplay; }
say $*
