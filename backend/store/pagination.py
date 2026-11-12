from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class CatalogPagination(PageNumberPagination):
    """
    Paginação customizada para o catálogo de produtos:
    - Permite que o front-end controle quantos produtos exibir por página via ?page_size=
    - Impede sobrecarga no banco com limite máximo (max_page_size = 48)
    - Retorna metadados completos (total_pages, current_page, page_size, count)
    """

    page_size = 4
    page_size_query_param = 'page_size'
    max_page_size = 48

    def get_paginated_response(self, data):
        return Response(
            {
                'count': self.page.paginator.count,
                'total_pages': self.page.paginator.num_pages,
                'current_page': self.page.number,
                'page_size': self.get_page_size(self.request),
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'results': data,
            }
        )
