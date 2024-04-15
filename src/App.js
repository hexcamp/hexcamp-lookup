import React, { useState } from 'react'
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  NavLink
} from 'react-router-dom'
import styled from 'styled-components'
import MVTExample from './mvt/H3HexagonMVT'

const StyledList = styled.ul`
  display: flex;
`
const StyledItem = styled.li`
  display: block;
  margin: 0 0.5rem;
`

const router = (homeLinkCounter, setHomeLinkCounter) =>
  createHashRouter([
    {
      path: '/',
      element: (
        <div>
          <nav>
            <StyledList>
              <StyledItem>
                <NavLink
                  to='/'
                  onClick={() => setHomeLinkCounter(homeLinkCounter + 1)}
                >
                  Home
                </NavLink>
              </StyledItem>
            </StyledList>
          </nav>
          <>
            <Outlet />
          </>
        </div>
      ),
      children: [
        {
          path: '/',
          element: <MVTExample />
        }
      ]
    }
  ])

export default function App () {
  const [homeLinkCounter, setHomeLinkCounter] = useState(0)

  return <RouterProvider router={router(homeLinkCounter, setHomeLinkCounter)} />
}
