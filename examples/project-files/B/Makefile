SHELL = /bin/bash

.PHONY: run 1 2 3

CASE=1

run: main
	@diff <(cat out_${CASE}.txt) <(timeout 2 ./main < in_${CASE}.txt)
	@echo -e "\033[32mPASSED\033[0m"

1:
	@make run CASE=1

2:
	@make run CASE=2

3:
	@make run CASE=3

4:
	@make run CASE=4

main: main.cpp
	g++ $< -O2 -std=c++23 -o $@

