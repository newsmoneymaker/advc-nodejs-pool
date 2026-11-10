# yphash: AdventureCoin's OWN yespower sources (copied from AdventureCoin/src/crypto/yespower, not
# borrowed from another coin -- see the critical-wrong-randomx-variant-bug lesson: a sibling algorithm can
# have different parameters and silently compute the wrong hash). BSD licence, see the headers in
# yespower-advc/.
#   make            (STATIC=-static makes a binary that runs on any Linux)
CC ?= gcc
STATIC ?=
# yespower-opt.c #includes yespower-platform.c itself (and re-#includes itself with macro redefinitions for a
# second pass) -- it is the only .c to pass to the compiler, do not compile yespower-platform.c separately.
yphash: yphash.c yespower-advc/yespower-opt.c yespower-advc/sha256.c
	$(CC) -O2 -fomit-frame-pointer $(STATIC) -o $@ yphash.c yespower-advc/yespower-opt.c yespower-advc/sha256.c -I. -Iyespower-advc
clean:
	rm -f yphash
