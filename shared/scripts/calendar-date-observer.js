/**
 * Automatically calculates the current day of the month (1-31)
 * and renders it dynamically on the Google Calendar app icon
 * so the taskbar icon displays today's real date.
 */
(function initCalendarDateObserver() {
  try {
    if (window.top !== window.self) return;
  } catch (_) {
    return;
  }

  let lastReportedDay = -1;
  const BASE_CALENDAR_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABmJLR0QA/wD/AP+gvaeTAAAgAElEQVR4nO3de5icVZ0n8O/vnPetW1d3p++5ERIJ4ZILhMjFURBkUBFdQcjIrOOO+ziru+7oXtV1mNl1HR332ZlVZ8dn1kd3dlzRcREEVBwFwSggaiBcAuSekJBOd/qevtT1fc/57R9V3V3VlxCS6vet7vf3eZ4izduVqlMn5/zec37nvG8BQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQoiao7ALsIjNrDsOpRTRJfVfAxIAXh8CgO0f+1hDo7vmciZaDgAWptcODT9/991/lS0/TxrjwpD6rzEJAGeGANAffuKLWzs6mr+SSiQvuPiC8+Lt7cvSxaKH4ycGJw6/eqKQzxUPZbLj//bvv3LX8yg1QmmItSH1v0AkALw2uvnmm2P/5tP/dccl69dsa0o3xNLpFBQRiAiZXB4nB06hb3AUh4/14vmX9g1msxP/+ORDO//Fyy/f60Ea4bmS+l9AOuwC1DnauHG7e9VNNz12561vu6aro9VNxGNgBqjcAD3fx0Q2j0y2gKJnEIsnU75vN7Svbr0pf6r52wMDe2zYH2IRk/pfYCrsAtQxAqBuvP3a/33dm664orkxfcbBctmy5mS6MX3F1e+48hso1bGMtF4/qf8ASACYGwFQ//Rf3rWto6315quuuDT1el+gsSGdisXcW7Z/+K5tkEb4ekn9B0QCwNwIgG7v7Pry2996TfvZvkgylWhrXNb0P1CaakkDPHNS/wGRADAbAaCrrrqxMRGPX9DS0nTWL6SVhgJduO3665smX7dWhVzCpP4DJAFgbmrVpZdfsWpFV/xcX4hIxdeueePlkLp+PaT+AyKVMhsBUDEntnpZc/p1zz1nvZhGyo07qyHz0DMl9R8gCQDVJhuIAtmmeCwWO/cXVDEGN2O6rqURzk/qP2ASAGYrzRWZa9dQSq8lc9AzI/UfIAkA8+AaNsBavlZUSP0HQwLA3BaiwUgjPHNS/wGRACBEhEkAECLCnLALsKC2b4y1AuuV0esJ3GoJaRAa5n0+l5JPXDBOr9dzda2K0ev13Nh6yyVpimsfRAySK9TmVA/1z8goxgSDhpntwSGHD+Pel4u1Kku9WVIBoGX7xjXK6huUg/cw6C1sbBslVI7SruW4VtpRMXaUAzrNVZDMYN8i49fu3zzTUrxFdTTfQo4CSKaipxVm/TMM+da3vi2iYCyNe6qtYJP0/i2DRHjS+vgRe3bH8A9eOl6zwoVs0QeArtu2dBpFfwAX/wrAKloe99GZbFRtMSDlAgqNwHQG6LTdjwEwA54FBhI1LGQC1NEMcssNUGLA3MKvfw1AK2B6B6IFOOMtx1DhDtWXfycPFXT7nZd1w6e/1cb+Q98Du/trV9DgLdoA0Hn7pi3WVZ+zFu+g5QmL89Mp6ohBepeoKQVQows0usDadJrA4IHihTg6/gXbl/9i+51bHtaG/6zv3hdfDLuoZ2PRBYDW2y/bqFz+awu6Bhsa47S2wYFTmcs81+n1Qt1JSu5QdWbqv/6pIwZ0tKXgW+CV7LvNwfG3t9+55Sku2I8PPfDS3pq8SUAWTQDo+uCWBlPgzwP8EXVRUwJr0wqqfLY/g39XhxysTnWhPb4MSR1HUifQ4Carn8QMZoYp+vCLfs3Kvrn5QmxddQl0zAERSR5gPiHVf8bLIWfyyJkCBgun0J3tg89n8P5agdanNa1rSPLRiRuwf2xX++9d9jUd5z/ru3t3pmYfYAEtigDQ+b6Nb7YFeoC6Eg20uSWF+GuvXq5tWIW3rNiKK1dtgptwMEF5jHIWeSqgaH148GF4xt2imMGW4Rc8TGTHa1b+hq400hsa4cRdkJIAMK+Q6r+LFFw4iCkHCY6jmVJIcwJewcfO7hfxq57ncDTbM/8baAJd0KhodSrJL576qOnLf6Dzjk239d/30lM1+xALpN4DAHXcsfkuq9Vn1LbWFDrLiaF5zvjLE22484KbcfHqdeAYEHecqYxAEi46SvnAeXG5ARadAg7HapfoXRvrxAUN5yEWj4NU6V52YrZ6q/9k0sWNy67CWy7eCioq7DlxGN879FOczA/N/RdiGrStLYW+XMo+N/xYx+9d/ucD33v+i6jjuV/dBoC1H1qbyGSbH+C0c626si2F5Pwrdxc1rcWdl74LB9weHKA+HMj1AbmzeNNyAzQFH5zxsCa95uw/QIUXMq9g91A3dNyREcDp1Hv9twJvu/I6rPdW4P/t+TEOjB2b82nUlQTe2pXgnUN/0v7+LW9eNpZ936GfHCqcw0dYMHUZADq2b0xn8s7DaI9vVW9sTU7N9WdYlerEH22+A7v0QdzjPw6caxUzwJZhiz4affccX2zakD+G8YIHxZMNsGYvvbQskvp/FgexYdNF+H17C77xwn3oyc1eCaSkA1zb2YBnR244BTzZsn3b747cu2v03N659uouALR+YH0T+/q3tCq1ljY1JwCaNYByyMFHLrkdY60evlPYAZgavTmXhqHWGliu3R3TLVv41kAxgawEgHktovrfVzyOfTiON229Cp0jKXxj3/3wbXXikIiAbS1J7KbNuif769YPrL9m+DuHxs793WunvgLA9o0xbfRPsTK1jjY1lzdjVPf+lclOfHjrHbi/+CSyuRqPqnhyHmrAXLtp22SjZluef0oAmNsirP9n8wfQ0BDHZ970EXzj2XtwMjc46zm0ZVkcit6guvHY2g+tvfboN4/ma1eCc1NPAYDalX4ArfHLaEvznPeCe+vyK7Fm3Rp8M/fIwpSgogEaW7vvkzC2dAYiCQCnt0jrf9Rm8U3/Ybxz6w04cuQVPH7ymVnPoU1NceT9jRMDzfcBeA/qJDFYNwGgY/uWP+EG5zpc0ZrCHPdvuG3tjch2AY9lnl24Qkw2QGPANWyAbC2MMSAjAeC0Fnn9PzLxDC49by3eF78R9x99bMZvCbS1NYlfDdzQ8f7Nnx6458X/tjCleH3qIgC03b7lalZ0F21rTdIcCb9/tuG9ONB4EkeyvQtbkKkzkIWpYYA2YPjWgqyRAHA6S6D+d+cO4w1tK/DB2D/B3Qd+WP1LRcAb21L8y/4/67xj0+P1sE8g9ADQ9cEtDbZAP6LLW5JIOLMGRu9beyP2pntxOH9i4QtTvhjFWgNPecgUzn2qZmDhKa+UhLKQi4FOZ4nU/4F8N4oNPm5dewMefGVH1e8ooYHLW1L2+eH7V75n2xt6frQrO8/LBCL0AGCK+Dx1xhumNvlUuG75lehvzeNALqCrL8sNkNki5xQxNHbqnF/SKIOcU4RlC7YkAeB0llD9H873oKEliWtz2/DEyV1Vv6OuBNCRaMz3Zz8L4FMLX5r5hRoAWrdvvBSMj9KlzcmZv1uZ6kT76g48MjE7obJgJhugNRhLF9C9r++cX9JnH6PpccC6IBkBnN4Sq//nsgdwy3lXY/nosVmrA7RxWUoN5P912+2b/8/Q91/cF0yJZgv1lmBK679RGxrjiKnSdeDlh0MaH9j8Hjwy/nTV8cAeAIy2GOZTGBk5+2Vbaywy8SysLs9rwvgsi/GxhOr/x2O/wR9c9l440NW/ixHowqY4ufTls/6ANRBaAGjdvvFSgK7BeQ2zyvDhS27H/x19JPh/L5T/JICVwq62PfjhL3951p9xpDCKPSsPg5UqvWble8gjMvV/9+jP8KFLbp1VPjo/pQFc13Lblk1n/SHPUWgBQCn9F1iXjkOVd/qVH8sT7TgWH0TG5MJphWWkCeNNWezO7sfjv3n9S4+jY6PojZ/ERFMOpCvGnKH3sjp/LMH6n/Cz6EmOYmWyE5VtHUSgdY1xHaM/f90fsEZCCQBdt23pJMY71JrUrP2ef7j5fXhifHd1RQX8ICKQIqi4g+c69uChHY9h+NSZb+MeGBrEq/1H8dLKA1DlC1CIKNTPtJgeS7H+fzn2PD646b2zykprUprYvnP59q0dZ/wBa6h2G65fh+TG5R+hFYnraUWq6rvfNjSdj97GMfT75579PWsEgBlc/pnZYu+OZ9GZ7EJbUyuUUojH3FIjJYLn+5jI5pHJFtA3MIJnX3oR+46/jKdOPAH3yhZQgwu4qhRq5Sbsr20J1/8E5dGQczBcqAhmioAJv8jjXn92b99vgy5TKPno9vdfdpC2tqyn1uodv5+6+o/w1ZEHwyhSNUapEfoWnPeRu78Hfm8WTW4zrr3oOnQu68BFF5yP85Z3ouj5OHTsBI4cO4GBsQHsPPIUxswYnBUNSN62ApRwMHU3Wsn+n5klXP9/vOy9+O87/67qGA8WwC+M7B+854WLgy5P4FXSsn3jGq2cverGrlTl2y9PtuOiiy/C0xOhrYhUm2yEnoX3wigKvxoCewbs+VAgNMdbkSjfUizv5TBaGIYFg1wH5GrE39wG9zK5E/BZW6L1f1X6Euzduwd9+eGKowz76Mmc9bFh+P7d3UGWJ/ApQOPFy2+jjtjNtCJZNfy/88J34dH8c7AViaDwEaAIqj0OeyIPLjCgFVgR8jaP8eI4xr1x5FEAOwoUc0AxB3p5ArHr2uuu8S0+S6/++7wR3Np6HZ4b3FN1nEe8PLLentze/t1Blif4jUAOvRvtiTRm9HPdGIM/VLsbQdYSuYT4OzpQeGQQdqgItoxShnfyCShldBVBtcUQf3s7yJ1sdRXPE2dlKdW/zz7iLalZZaKOeCNGiu8GcHeQ5Ql8BJDa1PnXan1TGrHpjMza9CqMNhYwUAwx+XdaBIoruBc1gpIa5AHsAUQKpBUopuF0xuFe1oT4tW2l/d6orzPP4ra06t/AQGcZo8WJ6YMOgBO5luzLfV8KsizBVtH2jbE2Vhl94wqn8p3ff8G78BP1DDxbnyOAKTzjh8ozUOUPddrwFr0lUv+ucnCT3YrvH354+iAD5ue93lBLrAFf3+UFVZZApwCtwHqKqxyo+va857WvRHGgzjt/lRm3KWNUN7o6GnIuTYu7/ovGx9r2VcDhioMEkKvy7SPeGwaB/UGVJdAAQKwuRMqZdaeHYR5H3f+rzVTnZ5klb5HX/yjmuAo45VqMFDdgqQYAZdHCMa0r+7pDDvq8oUXX/4U4F33eMBxyqm4kSi60JbQEWY6AVwG4kRyquuvHeenlOFEYQC1vAilEvesu9mN1qgNHJyq+ccjRDphP/+01NRZsAFCqkTW5VNHX2+JNGPAnZAQgIuWUN4HWeDOOjlcEAFe5YG4KshyBBgAGYqSpaukx6SSQ9U8BMgIQEZI1OaxyuqoPamhSas47Yi+U0G8J1uCkkDUF6f8iUjJ+Yfa3U4cg+AAweYlkmUsangls2VOIulA0RcTImb2cGbDQRwAAZP4voqkOljLrIgCwRAAhQhFOAKic8Fde1CFEpHDoye+6GAGEXQlChCKSU4AZScCpY0JEkSQBIbsAhQhJXQQAGQEIEY6QkoAzfpYRgIiiuabDAauLEYD0fyHCEXgA4BnfAFP6USKAiJ5SV6jsC8H3g7oYAUj/FyIcdREAZBVAiHCEnwSc6/+FiApJAkKygEKEpE4CQNgFECKawt8KzJIDEBE1R18IWkgjgFk7gcIphhChCr/tSxJQiDBJElCmAEKEpS4CQNhRUIioqoskIIxEABFB0U0CziABQIhQhJ8ElBGAiKrwFwHCCABzfGorAUBEVbhzAJkCCBFh4ScBAQkAIrokCQiwBAAhQlEXAUByAEKEQ1YBhAhLNFcB5iABQIhQhJQEnPHdgBIARBTNuEFuZJOAODge+lBIiEARgIvDLkSdBIDfOf9yaFIVRyQaiKVo+ttADdsQyzEt/CQggG998qtIJdzSr+TSYLGEEZWCQDbv4d89/Fehn+vqYgQwiZklAIglbzII1IPwdwKydHwRLVPtvQ4uB1av/RQhxFJVB1cDMogIRCSjABEJk+29HoYAdZEEnFRPcyMhFsKsNi5JwMqIKMTSNtnO66W910UAAOqnQoRYSPXWzutiFUBGACIqqkYA4acA6mMEUNn5JRCIKKiXdh5+ErD8c71UiBCBie7lwLLcJ0RJuH1BNgIJEWHhJwGFiDLZCiyECEvdJAGFiJw6GA3LCECICJMAIESEhZAEnHkjRJkDiIiqg74gIwAhIkwCgBARFv4qgBBRJqsAQoiwhL8TUEYDIqrqoC/ICECICAspByBDACHK98QPtQQyAhAiwiQHIERY6qAvyAhAiAgLfx+AjABEVMnVgEKIMIV/MZAQUSYXAwkhwiI5ACHCIjkAIUSYZB+AEGGpg75QB18MIhFARFX4c4DwcwBCRJnkAIQQYZEcgBBhqYO+ICMAISJMcgBChCl6Xw8efuZTiPoR7hxAcgBChKUO+oLkAISIsPBzADICEFFVB7NhGQEIEWHh5wCEiDK5FkCigYiq8M+GkgMQIizh93/JAQgRZeHnAGQEIKKqDvqCjACEiLBwtgLLdwMKgXroCzICECLCJAcgRFjqoC/ICECICAt/H4AQUSb7AIQQYQkpB8DV/y9EFNVBX5ARgBARFn4OQEYAIqrkWgAhRJjC3wcgRJTJPgAhRFjCvxaAZTggIorlWgAhRIgkAAgRYaEkAWUGIERdzABkBCBElIW0EUh2Agkx+4YgwZMRgBARFv5GIBkAiKiqg74gIwAhIiz8i4GEiDK5GEgIEZYQcgAzNwIEXgIh6sOsG4LIVmAhRIDCzwHICEBEVR1cGi8jACEiLNAAQEARFmYq8snZX0RdZV9gMmxtIci3D3YEYO04wF6g7ynEIkHWeiAaC/I9A84B0Dgs/Mpsp+978KwJthhChMyzPjzfq8r8s2UPRONBliPQEQCDhsFc1dszhSyKXjHIYggRukKxiIl8ZsZRsgQ7HGQ5Ah0BWG0OKaNU5dw/V8ih4MmsQERLwfOQzWer82DGKpA6GGQ5Ah0BDAOHmJGsPDY4PoJcIdC8hxChyxWLGJ4YqTrGQGKwxT0SZDmCTQLe+3KRiAdheCrz2T3Ug6LnB1oMIcLmeT66h3unVwAMQKABfH1XoMPhwPcBEOhJGIvJT+6ZIvK+5ABEtOS9AnzjYSoC+BYAHg+6HIHvBLRMD5Fn3wlHpSePnRzpg+9fAK1lX5JY+oyx6Bk5WT3/9+04s/1x0GUJvMdZZXbAkq489rPdjyNTkFGAiIZMvoCfvfCL6oOWHSi9I+iyBB4ARu59+VUwuuFP5wGe2rcTJ4eHMGNblDzksSQfvcODeHLfzulDpb5wbOjeF04gYOFcDET4W/LsF1jrFAAcHXgV47kMLANEoZRIiEAwA+O5LLqHeqYPepxl0P8KozyhTLq1wT/AsILlqSj4k+d+jmxelgPF0pbJFfDjXY9WDAgYZK1ylf5uGOUJIwBQ3wO7B5jwMHw2kzVx768ewPGBgRCKI0RwugcHcN+vf4CpCOCxAfCTk/c+Nwgg8PFv0FOAqQ9o2dylfLoJDqUAoHekHwd7juCCFSvgOnr+VxBikfJ8g33dh9B3qnyiK83/i76H/1LxNCr/JhBB9rSq6JbbOzCQuqTzehCthSrN/PedOIjrNr4FrU1NARZLiGAc7u3Fp771uekdgIYNLP98+IEXvzzjqYGNBMJceCcu4uPwbGEyF3DgxGEcPHEUni9XB4qlpej52Nd9CId6jpTO75YBzxbY8L9HCEP/SWGNAAgAcgf6h1OXdLURaAs0uQCw88AuvG3z29DeLKMAsXQc6D6BP/7Gf8JEbqJ0wEeWLX916IGXvld+SihBIKgRwFwfjgDAjGU+y9ZmJq8P6B3px4O/+UcMjQV6WbQQC2ZodBzf//WP0DtU3v1nmGHtGPUVP19+yrz9Y6EFNQKYdfYv/0n5IyNefH3Hk4rw+1DkgoBnDj+PGzZehxWtbZPpASEWJd8YvPDKIXzmW5+DnVz08jjne/6tw4/uewVz943AhBUAqoPA/oGe1IYuBnAVFMWstXji5V/j+k1vRXtzE0iCgFiEmBkHXj2OD//PT2AsWx7RejZDhr8w/IM99854eiiNvC4CAACV3df/m9TFndeAsRKa3Il8Bsf6u7F13Va0NDWGlyUR4iwwA0d6TuJPv/NF7Dm+v3TQ5xx8/sXggy/9B0xvBQpVEAFgZt+leR4qO57/YWpl803E6IAi52j/qxjNTWDj6ouxrDENIRaLV/v78aUHv4af7nqsdMBwHpb3FHYeu704XvRxZp1/wc97QQeAmWf+qc4PgDBWsBwzP3BbGm8l5jQUOXuP74dSGuu61qEpLUFA1Ddm4GjfSfzdI9/Ft39RSvCTzwUwH8u+1PvOzCunspju/HMFgUAHu/UUABQA5fflfNb+PW5L41sJaAPBefbQCziVGcWGFRehJZ0GyYRA1CFmxiu9J/GlB7+G7+wor+4ZzsNi78Qrx9+de2l4AtWdPnJTgJnzf4WZwWAZlD+SMzw4fr+zouUKBSwHwd17/ACO9B3DpjWbsSydhlJy8xBRP3xjcPB4N/70239RGvaXlvuybOwTQ08fvtPvncgiBUa+6trgSZM/L8lVgNdKAE6PAFqhYKHAUH7O59yh8YeS5zUxOWobQM6x/uP0yHM7cNm6rUglGpCMxwIovhCnNzw6jt1H9uPDX/kE9ry6f/IqvzznzZeHHn3lP6OQ80BgEBgNYOSm/urppgKBqJ8A0AEqd36ChQYaFJhVrie3SzXEduqkvpHAaiKfce5/6iFo5aKjsQtNqbTcSkyEwvMNjp7sw7d33IdP//1nS0t91uZh+VR+oPDPR5/pewjGWFCcAY+hYEEAGsHIVo0CIhcAZk8DGioCAEMBMYUEK7CjiyMT/f5g/h6nJZFSWl1iLdNv9z+jHnl2B9Z1rQXBRVNDCkpJbkAsPN9YHD15Ek/vewEf++p/xGPP/xLWGAvLRb/of3f8+YGP53tHj8MSI2YsDFnQVABgqKkAAExPB0JpvEG86WvlAEqPDij40LBQMHDADRpx68DGHbjWhcsaxrrJ81vWp1Y0f5IctZWJXCLWF65aj0/e/nFctGo9Vna0IxmLyZ2FRE0xA9lCET2DA9h/4hD+8r6/waGewwCTYWYDY3dlXx39y9yJkUPQyoNHBp7yoAo+CsoHZQw0fChYODAYgAWqHjMDAir+f8HUZwCw0DApFwnWsHFdDgAOjHWh2UnppBNfldygO5s+CldfTaVrqxLLWzpx+7XvxS1X3oR0sgGdLS1IJeKSMBRnxVqLbL6AvpERTOQy+PHTP8P3n3iwdD0/Iw9AoWh+YwbGvl44kTuQNTkfhvxyAPDLAcAgTwY660HBSACYOwAQuqDgVYwAbIODhNUwcQcxduBYB4ZdaOumdEprZWOwWuvmeIdemfxdNMTfA0InERkQkud1rMbvbLwaN229HqtaVyLuOnAcF4mYi7gbQywWg6PkxiMC8K1BsVhEwSsiX/Tg+R6KnocTQz149Llf4Fd7duJ4fzfAyDFYw3KfzXo/4p7so2a0MAhljLGqmDVZA6M8aPLgKx9F8qELPvLKQGX8qRGAC4O+qU4fuQAw+Wf1CkB1ANDlAODAJjRitiIAsJNSSdfR1mHLmpV2WbGGZUe3J7ucZcmtSMWuJFddClATAUUw2HUctbp9pdPe1K4S8aRKxRNoSDYE8PFFvcvkMsgUcsgXcnZwbNCeGOz1Pd+3IKsYyoXlMS7aPSgUn/YH8rvMaHYAinyyZMgajxQZ3yg/a3NeaQQwGQCUD5U3yCu/HADMjABQ2fnnSwpGJACsBKFYriIDDZuuDAAaxrpwrAPNTsqmHEdZlzU7rKwD5Wi21oHSWinlGAXNihW0ct3G2AqdcFdBqzRrSpKipAKlgOn9RBziDRlEeGiyc5X/a4EMW5snwzkYO27yXo83XuyFsR5ZstrCWGt9WGNIKR/WN2SVT4Z83yovq7KlKYCvStOAojLTAWCiFAA0LGIw6Jl19g8lAAR9T8C5sp2zs6BUPpYjiwQR8lCIkwGRgg9DTpZIOQrkEFSM2DJIKbA1sGTY4Zj1GQoeW/9U/pjH+W6tubQSq2IElH/W0vmjjgCGQbnNEcMWGQQ2hpgIhiwxiIzDZA0XDZgMKWVgyZCKGWJjfJvzSZGBTwaKLBQZ5MHQZJEjO7UHoNp8FwMFuiQYRACYb4mj+oP2gNEFW14pBWjCghsUiBhKGcAoKDIAKKNgGoxPU4XXmmHB0IrBrAwXrePFNWJsfRAR2NjSugCx8VTpr2iC0dOLBZolEESJoen2R4aNMQwARMoC4NLogKyjwCiSNapgiEsdnAwZKDJkjCHr+0RkMqqi8xuU2ixRqZPThC29Dxgatnz2B2af+Wda8GAQzheDzFYKEn1gtIPBKFUYMgY5AIkEoagMYAEXBI8p41ApCBAYFsxaMzFZJusQk7WONeyzdtkhjrPyuXTWp/ICoQUD5JViMwBM34ZQAsHSVt2pymd+mrw5Fpc6pKOJqUDWJ5/JIUNGWRCYWPnQsGSMISbfN77NKDLwYKHJwCNTGvoTI5czUBlT3t9a2uXSF/7mn0phBYDKUUF1hQzCoh0od0wGZSxUqhRNNTE8A7gKMMwZBxbGd5aBmDX5rB2HrG8YDoGtBrM2TpFgAMWsmEGOjleuRMCf3d0lACxtVR1vRgdg3xSYCGyJLByAfDAxGUAZgs+wbEmTT2zsKeNZaPLh02Tn96G1D60MiCwoU5rfT575B6vm+zPLEkpACCMAzOz8hFIiZHKx3oJAUOVRgAGQGwCSHUCBCHHtw7cMxzIMFBzwKfYNDGmAuBmKyGrFqmiIHGJwaZmRWREAazxiBpU+ugNiTzp8hBlyGfAB3wcRWEGVxgBEpakAkQV8JhuzUNaOamIY38D6Bprs1Ly/lPgrnf2JLHIDpryp3UztAKxO+JVHueEGgaACwHzJP8Jc0XAAjI5yBZWuDQByOUIyCRSZEQfDgEu7A9kixgrWN4CnFLsKrlJslQJbYnIJzAQCMTMBIAITyAIoYo5yiSihYrndKd1Q/YAAAAFsSURBVAClOTtNzd2JiT0GFJNrLHxjQZ4Fk4VDFkWy0GThkYFWBgVlS50/Z8sb2ye3tVkMVM33T5f1x2mO1VzYU4C5pgIAYKGgMBklCQwzAeQmGKlORgGMBDF8tohbVfqeQSgoq0fgo7Hgq5gbI4arGGZyuY+YWQFu6RUrFySryNeUL22nu4LUKycCafKMDYJmgmeLhSKPK1hAWRgq5alcsiioUhDIk4VSFtl+W3Xm1+W5/9zLfcDpg8CCC/LsN9d7zdwZWHls9h2DTv+Y7/Xme28hXst8HXWuLP5cj5mdfq6zfqjLgUGOAE63HEgz/pzJ4vQdfq4AALx2x5fAIIDX7mwzA8F8y3ivFRDm6vxnU56aCaMDzHzPuUYAk3/ONyqYeWzm68rZX9TKfEm6Mw0CmOPnuf6c6z2EEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIsUT9f2GCw9OvCxQ2AAAAAElFTkSuQmCC';

  let cachedBaseImg = null;
  function getBaseImage(callback) {
    if (cachedBaseImg) {
      callback(cachedBaseImg);
      return;
    }
    const img = new Image();
    img.onload = () => {
      cachedBaseImg = img;
      callback(img);
    };
    img.src = BASE_CALENDAR_ICON;
  }

  function generateCalendarDateIcon(baseImg, day) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base Calendar Fluent icon
    ctx.drawImage(baseImg, 0, 0, 256, 256);

    // 2. Render current day centered in Google Calendar blue (#1a73e8)
    const dayStr = day.toString();
    ctx.font = 'bold 78px "Segoe UI Variable Display", "Segoe UI", -apple-system, sans-serif';
    ctx.fillStyle = '#15803d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dayStr, 128, 168);

    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
  }

  function updateCalendarDate() {
    const currentDay = new Date().getDate();
    if (currentDay === lastReportedDay) return;
    lastReportedDay = currentDay;

    getBaseImage((baseImg) => {
      try {
        const rgba = generateCalendarDateIcon(baseImg, currentDay);
        if (rgba && window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('update_calendar_date_icon', {
            day: currentDay,
            iconRgba: rgba,
            width: 256,
            height: 256
          }).catch(() => {});
        }
      } catch (_) {}
    });
  }

  // Pre-load base image and update immediately
  getBaseImage(() => {
    updateCalendarDate();
  });

  // Check periodically (every 60s) for date change across midnight
  setInterval(updateCalendarDate, 60000);

  // Auto-dismiss and hide erroneous "could not load the data" toast
  function dismissDataLoadToast() {
    const alerts = document.querySelectorAll('div[role="status"], div[role="alert"], .YuhOnd, .M6CB1c, [jsaction*="toast"]');
    for (let i = 0; i < alerts.length; i++) {
      const el = alerts[i];
      if (el.textContent && el.textContent.includes('could not load the data')) {
        el.style.setProperty('display', 'none', 'important');
        const closeBtn = el.querySelector('button, [aria-label*="Dismiss"], [aria-label*="Close"], svg');
        if (closeBtn && typeof closeBtn.click === 'function') {
          try { closeBtn.click(); } catch (_) {}
        }
      }
    }
  }

  try {
    const toastObserver = new MutationObserver(dismissDataLoadToast);
    if (document.body) {
      toastObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          toastObserver.observe(document.body, { childList: true, subtree: true });
        }
      });
    }
    // Initial sweep
    dismissDataLoadToast();
    setInterval(dismissDataLoadToast, 1000);
  } catch (_) {}
})();
