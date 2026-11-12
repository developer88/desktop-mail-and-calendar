/**
 * Watches document title and DOM changes to extract unread email count
 * and reports it to the Tauri backend to set Taskbar title, main icon, and overlay badge.
 */
(function initUnreadObserver() {
  try {
    if (window.top !== window.self) return;
  } catch (_) {
    return;
  }

  let lastReportedCount = -1;
  const BASE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABmJLR0QA/wD/AP+gvaeTAAAgAElEQVR4nO3deZykVXno8d9z3vetrfe9p2dhnIFhE2KEMWCM4BKFSFBAc7Pox4CgMbkxxhjjdb1u0ZhobqLXBCKQkKto1BC3CAKKCCiCCLLDsMxMT88+3T29VtV7zrl/VFV3dU/Pxsy8Vd31fP2UXV099Huq+pznfc55Tr0FSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKNRypdQOOtX88nnS2teNEJ2aNMb7DeWkS75pq3S5Vf7yYCRHGvWME3FP50eEn3rGBfK3bdSwtuQBw1Yu613lnX5YWea1DzrS4jkzAZHPK+5TBRIFPhUZCgaDWbVX1w4ONnY+LVgoFh5soiExZcoGYPYK/t+D8t3wQ/uCP7t75ZK3bejQtiQBw5Rlta02Uuqy1q++KbFd3c39fp3Q0R5mWyJIOZ5+kr2kr1WJR3V/ysTBWNAyPFfLbtg+7qeGdYxN7dvwLxcI1l90z+nQt23k0LOoA8M/rO89rbW/7ZK5v5cmrVvSa3mYTNUfuoAPdayRQC5CDjAYBxouGHeOuuGlwh5vctvnR8T2j733rfXtuSqSBx8CiDABXndl9YWTc30aBX3ZKp21e1uz2+dtVD3Id7+q5qO5T8zuY9zA0bnh0OJyMrR/KW975tp8PfzfRBh4FiyoAXLO+bQ0SXpMSd+bze2xTf9Pcs31l0Fce8/MeV+pwVAZ9ZZDIvMcrj22dMDy0K5goOnO3Jb78ip+NPpNgM4/IoggAHuSaX+v4K7x8cF1HnFrb5sLqP4L3cwf9nECQyuJ710L7Mkjl8JnmZBuvFhWZHofCBDK8FXY+DYWpOQO/OhjMyQo8PDkSxE8OBwXv/Ufecu/w38oiSD7rPgBceUZLdxik/qM5cme+qC9uyUZ+zpndw77fLzsJ87LLkBNfQpDOEaVTRLkWJJVGjC7+q/3zzuIK08ST4xTzBWx+Av/YHbjbrkG2Pj5n4Avs8/1kDPdsiyYmiuZnkxTe8D9/Nra7Ns/k0NR1ALhqffsLAuSW1W2u+aROmzYsMNir7vP83yS46H2kOnpp7RsgnQpr1XS1hEwXYsa2D1HYs534hk8gD986M/AXCgLOw6N7gvzGvWbMWV5xxX3Dv6xd6w+sbgPAVevbzwlFvv0r3bZ5oNnJ/Pm8oyoIdK0ifMsXyK48ibbeXgJTt09LLWLWeUZ3bGNq0+PEV78d2TM4M/hN+d9UB4KhCePv3xlOFL17zR/dM3J7jZp9QHWZD191ZvuFoTE3rO+zzX1Ncwf//LO+P/NiUm+9kp6TTqe5tQVzsFqOUs+RESHb3EK2byX5016DGx6CrY+Xfli9MFi+35ry0p72qe0Twf/47b7Mg9/aOv1E8q0+sLoLAFetbz8nNOaGs5fFuY6MA+YN+PJ950EueBfZi95D36pVBIE50K9V6qgJjKG5vZ3CmrOIJcQ9+dPSD+bUDUtfcpGnO+ujLZPBa88fSN/xnaHpjYk3+ADqKgBceUbHaaHILev7bXNn1eCvfJ0z+F/zLprPfzs9AwOInvVVwkSEptZW4v5TKGLwT95dGvOy75pAJvS0p320bcK84cJlmRu/NTS9rXYtn6tuAsCVZ7R0h8bc86u9tr0n6wTmLvi58gPWA+svInfxX9EzMFCr5ioFQK6lmULviRR2bMQPPYFQ7rfz9qTkQk9TRLR90lxy4XGpq781mJ+qTYvnqou82YNEYXT96jbX0pdzc07nMyv85SDgu1eR/p2P6OBXdaNn+QDp3/04rnPFzImqej9KxbImJytbXVvgom/4OlmAr4sMYPkZHX/VkuL3X9Ab5+a/caeS+jtKqX/qT/8fvSedrnN+VTdEhExLK9MDpxHfcX1pGlCZAszbTdiT8cHQpOm5uz9X+NbQ1F01aXCVmo+ia9a3rQkC+dALe+PmSvo0M+j97MB3HjjtN8muOokorIu4pdSMKAzIrDwRd8q5M/210ner+zQCZ/QWmwQ+8sVfbT+upo2mDgIAEn7x+LY4lQ1n86V99vJTejFTF7+P9t6+hBuo1KHp6Osjc8kHS1PV8mPzvwLkQljbblNBZK5OtoX7qmkAuOrM7gtTxq9f0+rCOWHSg3ezX70DBk4i3dGnm3xU3QqMId3Zj+8/YbbfVvXl6tuaVhsG4s+66syO82vZ5poGgEjcp0/ujJuRfV6f2Xk/YIHwZZfR0resdo1V6hC09C0jOvdSLLP9d6G+LQInd9mmwMhnatfaGgaAq87sOD80fkVP1s15fE7K5Ct1f0940q/r3n5V99KpiPCUl+K8L1UB/MLTAID+nCNlWPEvZ3b+ZsLNnFGzABAKHz+x0zYttIen+u28lbf0Bpmm+qibKHUAIhBkm/FRZp93qi5kXUfcEho+kVT75qtJALjyjLa1iJzcl3MLpkfV6b8DpHcNUTpdi6YqddjCVIT0rJ7Th/fXz/uaHMCp16xvW1OLttYkABgxly5vtmZmu98Bbt55aB8gyumVvNXikMo1Q8eKUt89SP82HvqbbBC74M21aGttAoAxly9v8vs9pVfP/z1AphmT0gxALQ4mlUGyzbO7AavWARayotmnQ8PlCTVvjsQDwNVndp8Y4JtbUvtP//e5BRHG6AKgWhxMEOKD1CH379aUQ4S2K89oW5t4W5M+oPX2ZV3zVv4rDhQllVoK9tfHu7MOMcHLE20MNQgAoZELuzK+yVdS/Hk356ruVz2u1GKyUB+u7tvzb10Z1xSJ/HbS7azBGoCc2Z5aOAOopmNeLRWH0pfb0x4PLzrmjZkn0Yn1teeuztiJ0fZsVJ/DO44tD28YZOOWnYxP5vENmnqICM25NKuX93DKCSsIA33z1bGWCT3Wua5rz12dufS2Z6eTOm6iGUBhbPSElGEKDnHxr+p2rMWx5dafPMxDT2xmbGK6YQc/gPeesYlpHnxiMz/4ycPE1ta6SYvO4fZvAVIBU/mpvYnuB0h4CmDW5lL1ObIe3jDIruG9tW5G3dm5Zy+PbBisdTMaQlPknbHm+CSPmWgAEEN7Sgjq7vQPbNyyM5kDLULPDupr85wcZj+PDIHg25NsYrLFdUdLaHy4vzFdyxgwMZlP4CiL0+SUvjaH67n04VB8CLQcy3bNl2wGILSEhijJYx6qppzuNNyfXEZfmySEhsgLrUkeM9EA4PApUyfXIZxv9fKeWjehbj1vZW+tm9AQAiHwfv9b5I+FxPcBHO70P6kVw1NOWEFPZ6LBd1Ho7mjh5OOX17oZi1K99vVqtdlgf6Bn6qu+JvjKhEHAy88+lUc2DPLsoO4DaM6led6KXk4+frnuA3guajWiD1NNAkA9LgJCKQicfuJxnH7icQkdUS1V9XB2PxS1vyqwUqpmNAAo1cASnwIcKB2ql4URpY6Gw+3HjbEIeLBXY6FFQKUWo8PtuzXo6zoFUKqBLYoqgFKL0WLox5oBKNXANAAo1cBqUwXYTz5U+dnM16pbEpzz7BgeZ2RskkIhrtu0TR0eAVKpkI6WHD2dzZiFPo7qKJvpu2gVYFFwzvP0lt1M6FtflxwP5Asx23bvZWximjUruxMJAouBTgHKdgyP6+BvABPTBXYOj9e6GXWjJgGgHt8lNTI2mcBRVD3YMzpxzI9Rj318IZoBlBWKca2boBJSjA9+WfpGkfgaQOWDEhayv0XAJKSikHxBg0AjSIXJnPcOdxHQNcJOwMrSS61Tn/k6WnK1boJKSHtrffyt54+BWixLJj8FqJzVfekJC/URCHo6m2nKpGrcCnWsNWVT9HYmet3NfVT6e6X/V4+JpCVfBhTw5VDnZ/4PRMDNfpv4AokRYc3KbnYOj7NndIJi0dY8KKmjQ4AoCuhozdHb2ZLMPoD93ITSWbcyPZiNAtQkBUh+I5CAlEdW9QDz5XUZoRwIarBEakTo62yhr8ZnCLUEVPXbyl1T/mZm4DP7b4TZE2OSkl8DmB/5pPxalO9XTw/0DKwWu8pZfybNX6DPi5T/XSNMAZyUblB+/r4U+WamA+X7rpwReGqzOqrUkXB+9gTmPBhTdVKrOvtX+r6vGhdJSjwAiPdzpgCO8rxoXiAQmS0DCuC9x3uP6BZOVcdm+inl/ls+w0PpvpGqk15Vmls6GSZ/pkt8CrDigjdDrgkvHsQjUgoIjnIwqAz+SpYg4Mv5U3UgUKqeVA98vMfjEZk92Utl4FO1xoUvd3gPuabS2EhY4gGg60WvZPmffI7mM8/DYXAebGWZxM1uFKosClYyACgP/KpAoFQ9qAz82X5ZlQEw26dtuV/78v+cB4eh+czzWP4nn6PrRa9MvO2JTwHu+eSfcfL5F9F33ltoedH5DN/0r0xt+EUpKpbnBuJlZsJUejmrNw/IzFSgEgR0WqBqYab/Ve6XV/t8OQOYmfQbZlb5ZjJbILv6VDrPewtRz0p23PNDHvnefyb+HBIPAC84rZWNt32VbXffytrXvYXeP/gAk0/8nN03Xk08vL004I3HW5mZQ5V4vHfgpTT4Sw9pIFCJmz/wS995vKuc/UuPOGZr/i6YXRUMW7voeMUf0Hz6OYxvfopH/+nD2OFBfuXUbrZtH070uSQeAAb6MvR0DrB5cIzHrvsUzcedxNqL38bK//k5Ru+5ieFbv4wrTOEr0dJW5lcO8X7OwglU5lIaCFQyfPVaVOmRyg+o1Pq8d+XpKhD42ZNVlKb9Ja+j/SUXYaenefKrn2Pk8Z+zbKCV484eIB0l/xFsNbgsuCcKhTWrW+ntyfLMMxt54B/eTc+vnsPK83+f5lNfzJ7bvsrIvTeD8+Vpgcc7h/MOQajMuKRSUK2aFpQO8dyqBd57xicLTBdirNPFxmNFRAiMkEmHNGdTiyJg7zPPn5nk+zlTVO9LfdVT6ru+XAZoOvVsul79hwQtHWy57Ztsu+t7tLcFvPCFy2hpCSsHSfx51SAAzL4VszkXcNopHQyPFnnqsdv5xUP3sPJVv0Pvb7+dlhe+im3f+ReKmx4rR1OLdxbEgEhpncCY8s+OfFrgvWfP3ikKRXsMnrSq5r0ntqVgWyhaOluzdRsE9jvPn0n3gfKAn30Lqy1nApAaWEP/BVeQXXUSww/fyzPf/RiRG+fkk9rp7kqXf13t3p6c/FZgt++TbW8NeMGvdLF95zTP3nQN2+68kTWvfxvHvfVTjDzwI4Z37SwNfl96ocUbvAjeeYyY8g7CqkDwHKYFlc6oklUoWsanCrTk0rVuyhwHmueXMoHSYHfeVWUCpfveWUwqQ/8FV9B11m8xsXOIh678KIWdT7FiVSvL+7sJAykHjtqqyRRgIYHAQG+GzrYUm7eO8PjVH6ZpzQtZe/EVtHUvJ4pSMxmAl/LAd4ITjxjDzP7Kmb2X+64PHCgITOu1AGpmOh/XVQCYqeczW9Yrf8NMORqPc668eac6EDjCMGL1696GHdnB09+8luFf3k5vf5ZVv9pDNm2qflft1XQKsJBMCk44Lsey7jTPbH6I+z/zTvovfBsn/N4pBIHBFvN4a3G+VBIUTHkHkRx0feBA2YBdIDNRyaiX1/5AZb2ZdH9mga802CsD3zuHGEMQZUkFni0P3s2mr36W9ibLaae20d4alQ9SH8+1IvkAcIgb+5uzhuef0MyukSIbf3gNDxcKrDnvd2lZvhqsxcb50gsvHszstAARDAtMC+CA6wOBMcS2vv44jaLWV+g9eFmPBdN979zMmTyM0hCETOzYwtM3foWJH/4bJx4X0dfVVNoKXKdvaKm7DKCaAD3tIe3Nnm0P/ztPPP5jWs9+A6te8VrSLe14G+NcEW9t6c0ECOLNzLRAqqcFlcPvZ30gkw4ZnywctaepDl0uW7sLsRxSWa9chSptSy2X+cpZiwQhJojIT+xl6M6b2P2j6+mceILj14SkogBw1HyifwB1HQAqogBW9oR0T29i8Na/46H7b6L3VZeyfP25BFEWFxfwLp5dH8CUtlyWpwUcYFoApT9+czZFoWh1ITBhqdDQlIkSP+7hlPVma/ulvereO4wEmCiNszFbf/5jtt54DZlt93JiJ+T6K2W9+s8o63YKsJBsSjihXxgZf4AtX3oPwz/9DZa/5nK6TjwdfIiNC+BcOQMobyM81LIh0NGSYWK6yHRe9wEcS5V9ANlMRFMmSrQE+FzKenPSfRHCKAMmYPiZx9n8navhsVtZ0TRFV39YvqLN4uk3iyIDmK+92dCai9kx+H02fu4edp31elac90aaevpL04K4UJoWiMxZHzhY2dCI0JxNLZrNKerQHVlZrxQQgjCNBCFTu3cxeMtXGLvjerpkJ8v6UgTGUO/p/kIWZQCA0vuq+zsDOuNRtt19JY/ddyOdv3kpK899HWE2h7NFvI1LkVs8cpTLhmrxONg8/2BlPTEhQZjC5qcZ/NG32HXT1bTufZKTegzpKGQxDvyKRTUFWEjKwKqekM6pzWz5r4/y4N3fpv+Ct9F/xksxQYQr5nHWlv6wh1k2pNxhNBAsTgum+/4wynpBQBBl8cDOh+9hyw1fINz0E9Z2Qkt/ed/+Ikr3F7JoM4D5mjOwbgD27L2XoX9+gN2nvJyVl/wZ7avXYZydWR84WmVDVb+OuKwnEKYyiAkYHXyGwf/6Avn7/5u+pml6l4c13757NNXNTsCjQYCuFkN7k2Xr099jw1/fSctLfo9VF7yFbGc3zsY4WzgqZUNVn46orCdggggTRkyP7mHLzdczfPPVdJoR1vaHhEFQNzv4jpa6eC/A0WaA5Z2GruI4Q7f/E4/c+x26XvPHrHj5JQSpHK6YX7Bs6ABTWR+onhZQWQA+sncbqmPncMt6M+l+paxnQkyYwsUxg7d/m23/9Q80jW5gXXdANlVa4FsiJ/05lswUYCGZENb0G0YnBxm6/n/x8J1fZ9kl76bn9LOACFuuFjhTLhsipebNLxsiM5du1mlBfTk6Zb3SuxH3PPEAm//j7+CpO1jVLnQsK1/KZ4md9astqSnA/rRloXW5sGv4Xjb//RvZ+YLXsPJ33kXrwGpcYEsZwXMoG2ogqJ0jLesBmDCFCULGd2xh8BufZ/zur9OfK9AzYDCVDGKJW9IZQDUBelqgPRez9ZEbeOL9N9PxyktZceHbSLe04eJiqXSoZcO6d2RlPV/avhumKE6Os+X7X2b3t/+RFj/Kyb1CKhQWc1nvcNWgDFjbiVQksKoTugvjDN78Dzx01w30X/Julp3zOoJ0rlw2jLVsWIeOtKxnghATpfDesf0nNzJ0/SdIjTzN8Z1CU6Yc3Rd5We9wNcQUYCG5CNb1CcMTmxm6+h3suvU6VvzeB+h6/oswQfndhlo2rAtHXtYTwlQWMQF7NvySLV/+a+zjP6a/zdO9TGb++0aUfACoMx1N0JYVdu66l2c/eQk711/Iqje+n1z3AM4WZ7cVH6RsOHvNgdLv1UBwdBxxWS9MYYKIqT072Pz1v2fs9i/TlS3SP1B6P0Kjq0EGkPgRD8oI9LUJbU2O7b+8gUfefStdv/VHrLjgcqJcU7laUDxw2XDmEx5Lv1PLhkfmqJT1ojRxfpotN32J7V//NM12hHU9Qiaq/JFq9/zqRfL7AJI+4GFIh7CqW+icHmPLtz/NQz/8Est+//30veRCCCJcXChtJtKy4TFzxGU9YwijHIKw++c/YNO/foBgz0ZWdwqt2XJArs1Tq0sNPwVYSHMG1i0Tdo9tYegLf8zOG69h5R9+nPYTTi+vD0xr2fAoe67z/DllvSiNMSGjzz7C4HUfY/qR2+htFXoGBM32F9awi4AHI0B3M7TnYPv2e3jyQ79F29kXsepNHyLT0VNaH7AFLRseBYc6z1+wrIcvb99NURjbw+DXPsvuW/6NjkzM6uVCZMq/b3F0u8RpBnAQoYHlHUJnk2Po3q/z4M9voveCt7P8tW+f2VasZcPn5uiU9dL4uMiW713Ltq99mkxxhBN6hFyqMV/Tw6UB4BBlU7C2TxidGmfohk8zfPtXWPmmj9C1/tWYMHXAsuHR/hCTxW6fdH+hef7BynrpHCKGPQ/dxeAX/wq3fQMrOoSOrsZ4DY8WrQIcprYMtCwz7BrbxLOfuZTtJ/86q97yCZpXnVhaIKxsK64qG85fH2jksuGC6b5nJp2XeWW9OfP8SlkvjJjY8gybr/swE7+4me4W6B0Qgnnv5FQHp1WA50DE09MqtDfBto138uhfvpyuc36HFW/6EKmWjlK1IC6W0v1y2RAvWPENWzY81LKeWyjd9x4ThARhmuLEXjZ94xPs/N7VtESWdQNCqnxtjqXQt5KmU4AjEAWwskvoyDuG7vgKD9793/S/7h0su+CK0rbiciAolQ1LQcBXrQ8gS79seLhlPe9d+eelwS8mIIjS4C3bbvl/DH35rwnzwzyvU2jJ1upZLR0aAI6C5rSwbhkMT4yx9asfY/cPvsSKN3+UzjNeiQkibHE/ZUNZumXDIy7riRCkMogEjD56N5v+5T0Uh56grw26OoXF9WrUL10DOIo6ctCaNewYfYanPv0mdpz6ElZd/ilyy9eW3204u614KZcNn8v23TllvbBU1pvavpnN136Q0fu+T0cO1iwTQsOS7kNJq0EGsLT/eoHAsnbobIKhDXfwyF+cQ/cr38jK338/Ya4FW8zjbHFJlg0PVtabv313zodtlMt6QZTB5SfZ8o3/w9Zvfp5cUGRdH9Tgs0Magk4BjpF0BM/rgfFpy5Zb/41f3vktlr3hXfS9+g8xQQoX5/HOLomy4ZGX9UyprOc9u3/8n2y67kOYiV2sbBPaczV7Wg0h+SrA0k4A9tGUhhP6Yff4MIP/+kF2ff86Vl3+KVpPfTHeVW0rXqRlwyMp64kIJipdfXf8qV+w8ap3M/XMw/S0CL19BhHfcP0laZoBJKCyrbgtC9tHnuSxj7yetl85l9Vv/STp3tXlNxkVSlWCwygbQu3WB46krDezfTdKkd+9lS3XfZhdP/ku7RnLqmVCFMBSnyrWCw0ACYoCWNEBXU2eLY/+gAffeQ69r34zK97wl4TZZmycnykbVtYHDlQ2rF4fSCobODplvQwuP8XQNz/D1hs+T9pPcXy3kEvXx5SmkWgVoAayERzfI4xO5Rn67yvZc9vXWPHGD9B97v/ApCNsceFtxbUsGx6Nq/IEqSwC7Pnpt9l07fvxoztY1ip0Nun782tFM4AaastCS9qwc3yYZ/7pXey88YusuuJvaTrhhXjnSguFdVA2PPKyXhoThExtfJhNX3wvex+/l64mT19/efuuqhkNADVmjKevFTqbhG3bH+XhD7yW7vWvYuVlHyfqGsAVC9iqsqGZNy04lmXD/ZX15s/zFy7reUwYEkRp7Mgunv3SR9lx+w20RDEn9lG++q6qNa0C1InQlNYH2vOWrfd9jwceuJ2B11zBsov/lCjdVNpN6Gw5Azi2ZcNDKevJAdJ9MYYwk8XHeXZ855/Z/B+fJciPsbodWjKVYxzd1089N7oRqM40p+H4XhieGGfrf/49O2/7Cse9+cO0n/XbeFKz24oPUDZ8rusD+5vnH3JZz5hSWQ8Y/cUtbLr6feR3bKanBXo6ZmYqqo7oFKAOCaWdhG1Z2L53K0989u20nnAlx73178iuPgXnLC7OH6RsyAHXB/Z33NK/Lc/ty//hIZX1ylffnR56ksFr38ee+++gPedZ3QdhcIxeKHXENADUscDAQDt0NcPWTb/gofe+mp6zf4uVl/41YWsXNi5dtvxgZcP56wOwbxYwc8avpPt+Nt0/YFkvCAnCFG58hMGvfJKtt3yFXFDg+N5StUPVNy0DLgLpwLO6C/ZOxwzd9S2G77+d5Rf/Kb2vvowgU1kfOPSyITCzRgDMDHrg0Mt6xpTKesUCe265jo1f/jR+fDcr2pjdvqt/67qnGcAi0pqBln7YPTHCpus+xo6b/53jLvsELaefgw8NboH1gfkfYlLJCKrLhJUP1PRVA3/BD9solwMr8/yJR+5k4zUfZOLZR+ltge5+wYiO+sVErwi0CHWV1we2jjzLI594E52nv5hVl3+KdP8anLPYuFCa6y/wISaVQDBT2mN27l9Z4HPOlX8+t6wXhBEmDCnu3Mzm6/43O3/6fVpSlnV9EIVQCiFqMdEpwCIVCqxsh64mx9Ajd/DgX7yS/nNfz/I/+ABRUxs2LuJtcaZsCKWrEZXm+TJnDaC0yF9Z6AO8m5MBSBASplL46XG2fe1vGPzOtUR2gjWdQlO66peoRUenAItcLoLje2Bkcpqtt/w7O+/5Pivf8C66X/a7+FR236sRIeXqwbyiXGVTz5zUv7x91xbZc/vX2PzlTxHvHqK3Fbqa9Ko8S4EGgCWivXw1ol1jO3j6qvey4/vXsvryvyG37kw8MhMIvMzuD5hzEVKqsgChtH1XYOrpB9h49fvZ++R9dOagrx/dvruE6CcDLSEGT29L6dOOd2x7jAc/dAk961/Fqj/8CGH3cpwtf+x5ZYPQnGlA+eq7YYogCIlHdpbKerd9g2ZT5PhuyIQz/1gtEboIuASlQs+KDujIW4bu/R73P/Bjlp//Jvov+fPStuK4AHFxdnMQlOr5qQxSmGLnd69k039+HjM1ynFtVdt3a/aM1LGiU4AlrCntOb4X9kyMseW//okdd36X4974PtrXn4dLZ4nzU4AnSOcwzjH685vYdN3HmR7aQHczdPeiH6q5xGkVYIkToCsHbRnPjrGNPP7Zt9N2ylmsfsvHyKxYB0BhywY2XfsBdj9wF+1Zx6re0puTAP17LXGaATSI0MBAG3RkHVufuIsH3/Malr3sIgC2/vAGMjLN2q7SZyCqxqEBoMFkU7CmG0amptl26/UADLRCu37KTkPSKUCDas+UPugU5rwVQDUYrQIo/Zs0MHPwf6KUWqr0ikBK1ZVk6666BqBUA9MpgFINTAOAUg1MLwuuVA8uUt8AAAwLSURBVAPTDECpBqYBQKkGplUApRqY7gNQqq4kuw9ApwBKNTCtAijVwDQDUKqBaQBQqoFpAFCqgWkZUKkGphmAUg1MrwikVAPTTwZSqoHpFECpBqYBQKkGplUApRqYLgIq1cB0CqBUA9MpgFINTDMApRqYBgClGpheEUipBqYXBFGqgSU6BTBIwWkAUGpB1oGI5JM8ZqIBwHvGrNM5gFILsR4vnr1JHjPZKYBhrGgh0qVHpfZRPjmOJXnMZDMAx0hscUkeU6nFomjxHhlJ8pgJn4vdUxOxaABQagFjBfEucBuSPGaiU4BUS9uTo/nhoL8pyaMqtTjszWMKu/c8leQxk/0YEuCmV3TsPWNZ3JL0cZWqd/dtC0dfdctwe5LHTHw5biTPfUkfU6nFYGRa7kn6mIlvBBqZ5vqpAi/NRslnH0rVq6kifniKryZ93MQzAB+EP9g1KTbp4ypVz3ZMGhsZ+4Okj5t4APiju3c+uX3SjCd9XKXq2fZJ2XvZPaNPJ33cGrwZCLZOyD8XYt4bBbU4ulL1pejwO8bMF2px7JrsyZsWf+XQuIlrcWyl6s3gmLFFsdfU4tg1CQBv/+nIs5vGzBO1OLZS9WZwVB674mejz9Ti2LUIAALIjnH5i526GKga3PZJibflgz+nPC6SPn7SB5xzvG++tP3ZFy+PVyXcBqXqxh1D0TMX/Wh47byHE3vHbJIZwD7BZmhc/mTnpNEsQDWkbRNit4/JHy/wo8ROzElmAPOPJQBf+fXOO89dWTzLiF4mQDUO64XbNoU//r27hs8tPzR/ACQyIGpSBmQ2GMjQVPymJ4fNIyd22KhGbVEqcU/uMcXBcfdmSmPBV31NVFKV+IXO/gJw09b86FntWTfQ7M/JhLo9WC19I3nj7t0WfOAd94/cWH5ooX6fyFhIasDJAvdngsDxEHz0xR0//I3lxbP1akFqKSs6uH1z6qcf/umeczdAZf3LM3v2r84CjnlGUOspAIBsAH/X7vzrW6PUYy/s07cKq6XJe3hgRzR657b8RRv2TftrMgWoVQCYTz7/+ORwbxi+Im2C20/usplaN0ipo+3R4SB/77A97wvPToxSowE/XxIBYH/TDGHu5gf53MN7Hw1M68XpwHxzdZvTRUG1ZDwzaoo/2+Zf+38f3vsQc6fBFQsFg2MeJJLOAA4UDAD4zIN77zS0Xmox//q8VlcvGYpSz9mze03xJ1t582ce3vuTqlX3/Q3uRDODJBYBD7QAWLkFgOkGE0PgwLzzlJbfOLvf/Me6VpsSrQ2oRerJUVO4c8i//v88NnanAReC3QWO0s0yuwBYk4XAWgSA6iBgKl/7wNhyALAQ5CD4g3VNp720P3XDSe3FllCrA2oRKTp4bE809qOdxddd//j4Q5NgA7Bh6avbPhsEfNVXmBsIoEECQNBTDgAWgiYI4iaCyBGd0Z/qvLgne/Xzu90LWyOvYUDVvfGiuAeHg/u+unnysgd2F4aLhmI4gZ0oB4EA3M65GYAGgJ6q9D/bTGg9QcoRptIEGUfq8jVtb31+O+9c2eJCU/vFU6X2Yb2wedzEDw3z2aufGf3itKFQyGMLhjgQ7NQ4cWUaUC8BIImdgAsFgH2CQBOIA+NBohTGgwk8xoQE3mN+vjv/y51TfDeS1GlNET2ZwJv5kye96a1Wt915sQ/sDu6/YXD60m8PTdweC9YJ3lmcFZwRfFzACXgDfrL0n1H1K2qy0lUPGYABzP4ygChNaBxR6AmMI0qFRK8aaH3pC9qD96xqjns7Ul4vLKZqZrRg3MaxYNt9I/ZTN2/de2chpugMxViwzlAs5okPkAFU3+YHBKq+P2bqIgAMgClWBYCmFoLIEsWeIJUuDfzAE6YdkYkIJciFoQtS5/YFv3ZaB+9YlnUru1LO6EKhSkLsYVfeuG0Tsun+vfKPP95mfxYbW/B2MnZF4ryhaIXYGYqFPDYUbDGgODGGrQSACNxQHQSAuqizm3JaJOUbgAhe/Nz7IlXfC/4nu+09dw37y07ImRWntETnr2n2F7RnbLYtxESB1+KhOmoKVvzeIm4kH0w+My7fuX/Mfu/ZSbtFnBQr/dFT7ptU9dX598t93RzjgX2o6mEfgKFcBixWZQBFR5hyhKkMQegIjSM0nigdEhLmopQLQ/E+CNM+Eu+D0BMGzoerWoLlq5rMCway5iWdKb82E7hsJsRlAi8BXgKDGED3Fqhq3pdX5RzeIn7aip+OMdOxmdpTlKe2TLofb550D2wet4OxiI2F2IvYOC9FL2ILJo6JJ4v5mNgJRWeIY0NcmC4tAkaGuJIBRGC373v2rz7zN1YGABCAt6W/g69E1MrNCE4EbzyufN8aKQUOJ7gIEee9MyJ2cJKhLfnidvH+5ghMFJj0spzpbwuDgQhpCgOfDbzPBIGZ+YhSXxWkNC4sbdWjSaq+tdZNOJGp2MlUwfvJ0dgObZtyWwtxsVAE50Wct4F1iHPgjIgrlvtlLLhAsF5wBpyv6rNzbuUzf1AnZ39IPgAstNq5zyqoKb9YQemFFQETClYE44pYiUTyIiYFElrEe48EAs7jvPOhCZ3xsbGeAOftpsl4o4n9JhMgPkCMRzxWAsCz71RBVxWXpoWuPSeIt5SCgRO8WLyzeBdajxNrRbwRrJPQ2dhaMVhErLfYQMQWRayXOPYi1hexlRNUPNt/Syv/ss+gnz/Xr348MUkEgP2VOOY80XJkdA6EUQhacOIxU4LvMNi8LQUBD5KZnLCSaxLvQrwFCfAI3hp8ymOcs877MJAAJz4WcWK9cRJ7xDhvrAVDIHGABOWmeT/bRv3AgqWvMi+PAbF4i/UEYL04MXjvxHvBOQm9tzgv1hoRWxAcIhbBeivWi8SBEesnJ+y04Fx58KcNdlzwYTkQMFoKMgE4wz4Lfvsb9Mc8GNTLFMADUpkGjIFrGYN8CzY9BdMZJDLYwIEBsR4xxQkrYZPEhD6yeMF7CcUVnQ8DJ854Z731gaQjEe+NEIsH8V4EA4IDj8R+bnAKdBawpNnKoCoPLSN4MeX478GXdpl5R+i9iHP52CNinYizghcjsY9x3oqNRWInsfPFCesoTQNEsBjstODDKWzeYMMx3Bi4YG76XxfTgFoFgOqswAMMgl8BBKVFEQyIjJUiZiGHrcyjsOUfxvigOOF8jjD27T50PnbOh0FBrM96cZ5AHIEvllJ9vDGEXmwQSgASU34H0rzzvfMaAJayfVPxcKYHWPBiY08s3ohzMeCNeG/EesH6KfG2lAHE1ojzMuLMJHEsOGewTohdQBwbbEFw4cTsxp+gFACcAT9Yg8W+/alFAJg/+IXSoDflxjgHshdcKzAFZKcgzEIgiA2IjcN7h/dgjMWbaMTiCMTijWkT48TYgrdhVgTvTcEjBkzkBV90EuMlpPTODF8s1QMqL4SO/sZQGfQSWU9cngogXsT4Yuks5IzgRcTZKXyQEucNzsmo94IVg5ViKeX3gsMQO4ONTOl7O4WdKq/47y2f/aPSHoBKyu/KTahpEEgqAOxv8a/6vc++0phi+QUKAQcSCkxPIZkspHxpmiDgvSeQIk4KmDiFDSOM88aIxQTGG5dHJPJCKQBI0XsJQ8QjEpdb4AMkROf9jSgGxOMrq74CvhjjjYh35YqUK4gPDN5ZcS7AecHFRVwwhRPBeYPzpV1/NjK4guCmp3CRlM74YdWZPyzfOHDZjwM8dtTV/HMBmHdtgONBpss7Ax1IW2mHoMm0EMQek8lh0g4Te0zKY6Ly/RCMiUp/yjDVYpxPSeC9ibyvnOHFem+IDjLPLxz9J67qSGr/P7LF0qALRFxcHoBFEW9FnJGCjwtjLhRcoYCPwYWCK5YHfSi4vMFNT5buT49hQ3Cj5cEfgcuA27DwWwlg3wG/5ANA5bH5l0eaf7GQ6ncNHui2v9+3v2MrdTALpefzB+2BbvM3+Sw04GtaDkxyDeBA5UCZ93U+x4EH/EIBAA4+8DUwKDj4YJsfCPZXxjtYQFho8D+X9hw1tRgAB5oKzP+6v6xg/mPzf6+e/dXRsr9FukMNAixwf6GvCx1DKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkvU/wfPUTkRohs6/QAAAABJRU5ErkJggg==';

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
    img.src = BASE_ICON;
  }

  function formatCountLabel(count) {
    if (count >= 1000000) {
      return Math.floor(count / 1000000) + 'M';
    }
    if (count >= 1000) {
      return Math.floor(count / 1000) + 'K';
    }
    return count.toString();
  }

  function generateBadgedIcon(baseImg, count) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base Gmail Fluent icon
    ctx.drawImage(baseImg, 0, 0, 256, 256);

    if (count <= 0) {
      return Array.from(ctx.getImageData(0, 0, 256, 256).data);
    }

    // 2. Format badge text (matches Telegram taskbar badge style)
    const label = formatCountLabel(count);
    const fontSize = label.length <= 2 ? 46 : (label.length <= 3 ? 38 : 30);
    ctx.font = 'bold ' + fontSize + 'px "Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif';
    const textWidth = ctx.measureText(label).width;

    const bh = 72;
    const bw = Math.max(textWidth + 36, 72);
    const bx = 256 - bw - 6;
    const by = 4;
    const r = bh / 2;

    // 3. Soft ambient drop shadow underneath badge
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 4. Vivid red pill badge (#eb4034 matching Telegram badge)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bw, bh, r);
    } else {
      ctx.arc(bx + r, by + r, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#eb4034';
    ctx.fill();
    ctx.restore();

    // 5. Crisp centered white text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);

    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
  }

  function generateOverlayIcon(count) {
    if (count <= 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const label = formatCountLabel(count);
    const fontSize = label.length <= 2 ? 16 : (label.length <= 3 ? 12 : 10);
    ctx.font = 'bold ' + fontSize + 'px "Segoe UI", -apple-system, sans-serif';

    // Red circle / pill
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#eb4034';
    ctx.fill();

    // Dark outline
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.stroke();

    // Centered white text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 16, 17);

    return Array.from(ctx.getImageData(0, 0, 32, 32).data);
  }

  function extractUnreadCount() {
    // 1. Check document.title: "Inbox (66) - ...", "(255K) Inbox...", "Posteingang (4)..."
    const titleMatch = document.title.match(/\(([\d,]+|\d+[KkMm\+]?)\)/);
    if (titleMatch) {
      const raw = titleMatch[1].replace(/,/g, '');
      if (raw.endsWith('+')) {
        return parseInt(raw.slice(0, -1), 10) || 0;
      }
      if (raw.toLowerCase().endsWith('k')) {
        return Math.round(parseFloat(raw.slice(0, -1)) * 1000) || 0;
      }
      if (raw.toLowerCase().endsWith('m')) {
        return Math.round(parseFloat(raw.slice(0, -1)) * 1000000) || 0;
      }
      const num = parseInt(raw, 10);
      if (!isNaN(num)) return num;
    }

    // 2. Check sidebar inbox badge element
    const sidebarEl = document.querySelector('a[href*="#inbox"] .bsU, .aio .bsU, [data-tooltip*="Inbox"] .bsU, [aria-label*="Inbox"] .bsU, div.bsU');
    if (sidebarEl && sidebarEl.textContent) {
      const clean = sidebarEl.textContent.trim().replace(/,/g, '');
      const parsed = parseInt(clean, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return 0;
  }

  function inspectAndReport() {
    const count = extractUnreadCount();
    if (count === lastReportedCount) return;
    lastReportedCount = count;

    // Fast, CSP-proof title command trigger for Rust backend
    try {
      const prevTitle = document.title;
      if (!prevTitle.startsWith('__desktop_cmd__:')) {
        document.title = '__desktop_cmd__:unread:' + count;
        setTimeout(() => {
          if (document.title.startsWith('__desktop_cmd__:')) {
            document.title = prevTitle;
          }
        }, 40);
      }
    } catch (_) {}

    if (window.__TAURI__ && window.__TAURI__.core) {
      if (count <= 0) {
        window.__TAURI__.core.invoke('update_unread_badge', {
          count: 0,
          iconRgba: null,
          overlayRgba: null,
          width: null,
          height: null
        }).catch(() => {});
      } else {
        getBaseImage((baseImg) => {
          try {
            const rgba = generateBadgedIcon(baseImg, count);
            const overlayRgba = generateOverlayIcon(count);
            window.__TAURI__.core.invoke('update_unread_badge', {
              count: count,
              iconRgba: rgba,
              overlayRgba: overlayRgba,
              width: 256,
              height: 256
            }).catch(() => {});
          } catch (_) {
            window.__TAURI__.core.invoke('update_unread_badge', {
              count: count,
              iconRgba: null,
              overlayRgba: null,
              width: null,
              height: null
            }).catch(() => {});
          }
        });
      }
    }
  }

  const observer = new MutationObserver(function() {
    inspectAndReport();
  });

  function attachObservers() {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      try {
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
      } catch (_) {}
    }
    if (document.body) {
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachObservers();
      inspectAndReport();
    });
  } else {
    attachObservers();
  }

  window.addEventListener('focus', inspectAndReport);
  document.addEventListener('visibilitychange', inspectAndReport);

  // Periodic fallback check (every 1s)
  setInterval(inspectAndReport, 1000);

  // Pre-load base image
  getBaseImage(() => {
    inspectAndReport();
  });
})();
